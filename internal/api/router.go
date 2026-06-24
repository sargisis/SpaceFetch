package api

import (
	"net/http"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
)

func NewRouter(db *database.MongoDB, rcache *cache.RedisCache) http.Handler {
	h := NewHandler(db, rcache)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/asteroids/today", h.GetTodayAsteroids)

	var handler http.Handler = mux
	handler = CORS(handler)
	handler = RateLimitMiddleware(rcache)(handler)
	handler = AuthMiddleware(handler)

	return handler
}
