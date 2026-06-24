package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/models"
)

type contextKey string

const apiKeyCtx contextKey = "api_key"

// Eventually this will check a users collection in MongoDB.
// For MVP, any non-empty key is accepted.
var validKeys = map[string]bool{}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" {
			key = r.URL.Query().Get("api_key")
		}

		if key == "" {
			writeError(w, http.StatusUnauthorized, "missing X-API-Key header")
			return
		}

		if len(validKeys) > 0 && !validKeys[key] {
			writeError(w, http.StatusUnauthorized, "invalid API key")
			return
		}

		ctx := context.WithValue(r.Context(), apiKeyCtx, key)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RateLimitMiddleware(redisCache *cache.RedisCache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key, _ := r.Context().Value(apiKeyCtx).(string)
			if key == "" {
				writeError(w, http.StatusUnauthorized, "missing API key")
				return
			}

			allowed, err := redisCache.CheckRateLimit(r.Context(), key, 5, 1*time.Second)
			if err != nil {
				log.Printf("rate limit error: %v", err)
				writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}

			if !allowed {
				writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}

			next.ServeHTTP(w, r.WithContext(r.Context()))
		})
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Status:  strings.ToLower(http.StatusText(status)),
		Message: message,
	})
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "X-API-Key, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
