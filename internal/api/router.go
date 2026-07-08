package api

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
)

type spaHandler struct {
	staticPath string
	indexPath  string
}
// ServeHTTP serves static files and falls back to index.html for SPA routes.
func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Join path with staticPath
	path := filepath.Join(h.staticPath, r.URL.Path)

	// Check if file exists and is not a directory
	fi, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			// File does not exist, serve index.html (SPA fallback)
			http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
			return
		}
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if fi.IsDir() {
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	}

	// File exists, serve it
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

// NewRouter sets up the HTTP router with public and protected endpoints, middleware, and static file serving.

func NewRouter(db *database.MongoDB, rcache *cache.RedisCache, frontendDir string, secureCookies bool) http.Handler {
	h := NewHandler(db, rcache, secureCookies)

	mux := http.NewServeMux()

	// 1. Public Endpoints - health check and developer registration.
	// Registration and login are IP-rate-limited so they can't be scripted
	// to flood the database or brute-force passwords.
	registerLimit := IPRateLimitMiddleware(rcache, "register", 5, time.Minute)
	loginLimit := IPRateLimitMiddleware(rcache, "login", 10, time.Minute)

	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.Handle("POST /v1/users", registerLimit(http.HandlerFunc(h.RegisterUser)))

	// Cookie-session auth for the web console
	mux.Handle("POST /v1/auth/register", registerLimit(http.HandlerFunc(h.AuthRegister)))
	mux.Handle("POST /v1/auth/login", loginLimit(http.HandlerFunc(h.AuthLogin)))
	mux.HandleFunc("POST /v1/auth/logout", h.AuthLogout)
	mux.HandleFunc("GET /v1/auth/me", h.AuthMe)
	mux.HandleFunc("POST /v1/auth/regenerate-key", h.AuthRegenerateKey)

	// 2. Protected Mux
	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("GET /v1/asteroids/today", h.GetTodayAsteroids)

	// Wrap protected endpoints with Auth and RateLimit middlewares
	var protectedHandler http.Handler = protectedMux
	protectedHandler = RateLimitMiddleware(rcache)(protectedHandler)
	protectedHandler = h.AuthMiddleware()(protectedHandler)

	// Mount protected handler
	mux.Handle("/v1/asteroids/", protectedHandler)

	// 3. Serve Frontend static files if the directory exists
	if frontendDir != "" {
		if _, err := os.Stat(frontendDir); err == nil {
			log.Printf("Serving frontend static assets from %s", frontendDir)
			spa := spaHandler{staticPath: frontendDir, indexPath: "index.html"}
			mux.Handle("/", spa)
		} else {
			log.Printf("Warning: Frontend directory %s not found. Frontend serving is disabled.", frontendDir)
			mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
				http.Error(w, "Frontend assets not found. Make sure to build the frontend.", http.StatusNotFound)
			})
		}
	}

	// Apply global CORS middleware
	return CORS(mux)
}
