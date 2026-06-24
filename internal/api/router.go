package api

import (
	"net/http"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
)

func NewRouter(db *database.MongoDB, rcache *cache.RedisCache) http.Handler {
	h := NewHandler(db, rcache)

	mux := http.NewServeMux()

	// 1. Public Endpoint - Developer registration
	mux.HandleFunc("POST /v1/users", h.RegisterUser)

	// 2. Protected Mux
	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("GET /v1/asteroids/today", h.GetTodayAsteroids)

	// Wrap protected endpoints with Auth and RateLimit middlewares
	var protectedHandler http.Handler = protectedMux
	protectedHandler = RateLimitMiddleware(rcache)(protectedHandler)
	protectedHandler = AuthMiddleware(db, rcache)(protectedHandler)

	// Mount protected handler
	mux.Handle("/v1/asteroids/", protectedHandler)

	// Apply global CORS middleware
	return CORS(mux)
}
