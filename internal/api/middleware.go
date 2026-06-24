package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
	"github.com/sargisis/spacefetch/internal/models"
)

type contextKey string

const (
	apiKeyCtx contextKey = "api_key"
	userCtx   contextKey = "user"
)

func AuthMiddleware(db *database.MongoDB, rcache *cache.RedisCache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-API-Key")
			if key == "" {
				key = r.URL.Query().Get("api_key")
			}

			if key == "" {
				writeError(w, http.StatusUnauthorized, "missing X-API-Key header")
				return
			}

			hashedKey := hashAPIKey(key)

			// 1. Try Redis cache first
			user, cached, err := rcache.GetUserCache(r.Context(), hashedKey)
			if err != nil {
				log.Printf("auth: redis cache error: %v", err)
			}

			if !cached {
				// 2. Cache miss — check MongoDB
				user, err = db.GetUserByHashedKey(r.Context(), hashedKey)
				if err != nil {
					writeError(w, http.StatusUnauthorized, "invalid API key")
					return
				}

				// 3. Set Redis cache for subsequent validation
				if err := rcache.SetUserCache(r.Context(), hashedKey, user); err != nil {
					log.Printf("auth: failed to cache user: %v", err)
				}
			}

			ctx := context.WithValue(r.Context(), userCtx, user)
			ctx = context.WithValue(ctx, apiKeyCtx, key)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RateLimitMiddleware(redisCache *cache.RedisCache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, _ := r.Context().Value(userCtx).(*models.User)
			if user == nil {
				writeError(w, http.StatusUnauthorized, "missing user context")
				return
			}

			// Tier-based limits
			limit := 5
			if user.Tier == "premium" {
				limit = 50
			}

			// Rate limit based on user's unique email or hashed key
			allowed, err := redisCache.CheckRateLimit(r.Context(), user.Email, limit, 1*time.Second)
			if err != nil {
				log.Printf("rate limit error: %v", err)
				writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}

			if !allowed {
				writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}

			next.ServeHTTP(w, r)
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
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "X-API-Key, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
