package api

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
	"github.com/sargisis/spacefetch/internal/nasa"
)

type spaHandler struct {
	staticPath string
	indexPath  string
}

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

func NewRouter(db *database.MongoDB, rcache *cache.RedisCache, nasaCli *nasa.Client, frontendDir string) http.Handler {
	h := NewHandler(db, rcache, nasaCli)

	mux := http.NewServeMux()

	// 1. Public Endpoints - health check and developer registration
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("POST /v1/users", h.RegisterUser)

	// 2. Protected Mux
	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("GET /v1/asteroids/today", h.GetTodayAsteroids)
	protectedMux.HandleFunc("GET /v1/apod", h.GetAPOD)
	protectedMux.HandleFunc("GET /v1/epic", h.GetEPIC)

	// Wrap protected endpoints with Auth and RateLimit middlewares
	var protectedHandler http.Handler = protectedMux
	protectedHandler = RateLimitMiddleware(rcache)(protectedHandler)
	protectedHandler = AuthMiddleware(db, rcache)(protectedHandler)

	// Mount protected handler
	mux.Handle("/v1/asteroids/", protectedHandler)
	mux.Handle("/v1/apod", protectedHandler)
	mux.Handle("/v1/epic", protectedHandler)

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
