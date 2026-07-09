package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
	"github.com/sargisis/spacefetch/internal/models"
	"github.com/sargisis/spacefetch/internal/nasa"
)

// Basic email format regex
var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

type Handler struct {
	db      *database.MongoDB
	cache   *cache.RedisCache
	nasaCli *nasa.Client
	// secureCookies marks session cookies Secure (HTTPS-only) — enable in production
	secureCookies bool
}

func NewHandler(db *database.MongoDB, cache *cache.RedisCache, nasaCli *nasa.Client, secureCookies bool) *Handler {
	return &Handler{db: db, cache: cache, nasaCli: nasaCli, secureCookies: secureCookies}
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	status := http.StatusOK
	checks := map[string]string{
		"mongodb": "ok",
		"redis":   "ok",
	}

	if err := h.db.Ping(ctx); err != nil {
		checks["mongodb"] = "unavailable"
		status = http.StatusServiceUnavailable
	}
	if err := h.cache.Ping(ctx); err != nil {
		checks["redis"] = "unavailable"
		status = http.StatusServiceUnavailable
	}

	overall := "ok"
	if status != http.StatusOK {
		overall = "degraded"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": overall,
		"checks": checks,
	})
}

func (h *Handler) GetTodayAsteroids(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	// 1. Check cache; on cache error fall through to MongoDB
	asteroids, cached, err := h.cache.Get(r.Context())
	if err != nil {
		log.Printf("asteroids: redis cache error: %v", err)
		cached = false
	}

	// 2. Cache miss — fetch from MongoDB
	if !cached {
		asteroids, err = h.db.GetTodayAsteroids(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "database error")
			return
		}

		// Best-effort cache write
		if err := h.cache.Set(r.Context(), asteroids); err != nil {
			log.Printf("asteroids: failed to cache: %v", err)
		}
	}

	resp := models.APIResponse{
		Status: "success",
		Meta: models.ResponseMeta{
			Cached:         cached,
			ResponseTimeMs: time.Since(start).Milliseconds(),
			TotalObjects:   len(asteroids),
		},
		Data: asteroids,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// GetAPOD serves NASA's Astronomy Picture of the Day, cached for an hour.
func (h *Handler) GetAPOD(w http.ResponseWriter, r *http.Request) {
	h.serveCachedFeed(w, r, "apod:today", func() (interface{}, error) {
		return h.nasaCli.FetchAPOD()
	})
}

// GetEPIC serves the latest DSCOVR EPIC Earth photo, cached for an hour.
func (h *Handler) GetEPIC(w http.ResponseWriter, r *http.Request) {
	h.serveCachedFeed(w, r, "epic:latest", func() (interface{}, error) {
		return h.nasaCli.FetchEPICLatest()
	})
}

// serveCachedFeed returns a cached upstream payload or fetches, caches, and returns it.
func (h *Handler) serveCachedFeed(w http.ResponseWriter, r *http.Request, cacheKey string, fetch func() (interface{}, error)) {
	start := time.Now()

	payload, cached, err := h.cache.GetRaw(r.Context(), cacheKey)
	if err != nil {
		log.Printf("%s: redis cache error: %v", cacheKey, err)
		cached = false
	}

	if !cached {
		data, err := fetch()
		if err != nil {
			log.Printf("%s: upstream fetch error: %v", cacheKey, err)
			writeError(w, http.StatusBadGateway, "upstream NASA feed unavailable")
			return
		}
		payload, err = json.Marshal(data)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal server error")
			return
		}
		if err := h.cache.SetRaw(r.Context(), cacheKey, payload, time.Hour); err != nil {
			log.Printf("%s: failed to cache: %v", cacheKey, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"success","meta":{"cached":%t,"response_time_ms":%d},"data":%s}`,
		cached, time.Since(start).Milliseconds(), payload)
}

func (h *Handler) RegisterUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req models.UserRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	if !emailRegex.MatchString(req.Email) {
		writeError(w, http.StatusBadRequest, "invalid email format")
		return
	}

	tier := req.Tier
	if tier == "" {
		tier = "free"
	}
	if tier != "free" && tier != "premium" {
		writeError(w, http.StatusBadRequest, "invalid tier, must be 'free' or 'premium'")
		return
	}

	apiKey, err := generateSecureAPIKey()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate api key")
		return
	}

	hashedKey := hashAPIKey(apiKey)

	// Key-only developer account: no password, no console session
	user, err := h.db.CreateUser(r.Context(), req.Email, hashedKey, "", tier)
	if err != nil {
		writeError(w, http.StatusConflict, "email already registered")
		return
	}

	resp := models.UserRegisterResponse{
		Status: "success",
		Email:  user.Email,
		APIKey: apiKey,
		Tier:   user.Tier,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// Helpers

func generateSecureAPIKey() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "sf_live_" + hex.EncodeToString(bytes), nil
}

func hashAPIKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}
