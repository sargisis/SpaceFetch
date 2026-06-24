package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
	"github.com/sargisis/spacefetch/internal/models"
)

type Handler struct {
	db    *database.MongoDB
	cache *cache.RedisCache
}

func NewHandler(db *database.MongoDB, cache *cache.RedisCache) *Handler {
	return &Handler{db: db, cache: cache}
}

func (h *Handler) GetTodayAsteroids(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	// 1. Check cache
	asteroids, cached, err := h.cache.Get(r.Context())
	if err != nil {
		http.Error(w, "cache error", http.StatusInternalServerError)
		return
	}

	// 2. Cache miss — fetch from MongoDB
	if !cached {
		asteroids, err = h.db.GetTodayAsteroids(r.Context())
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		// Best-effort cache write
		if err := h.cache.Set(r.Context(), asteroids); err != nil {
			// log but don't fail
		}
	}

	resp := models.APIResponse{
		Status: "success",
		Meta: models.ResponseMeta{
			Cached:         cached || false,
			ResponseTimeMs: time.Since(start).Milliseconds(),
			TotalObjects:   len(asteroids),
		},
		Data: asteroids,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
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

	user, err := h.db.CreateUser(r.Context(), req.Email, hashedKey, tier)
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
