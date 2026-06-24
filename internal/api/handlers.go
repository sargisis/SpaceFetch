package api

import (
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
