package api

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
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
	if os.IsNotExist(err) || fi.IsDir() {
		// File does not exist or is a directory, serve index.html
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	} else if err != nil {
		// Return internal server error if stat fails unexpectedly
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// File exists, serve it
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

func NewRouter(db *database.MongoDB, rcache *cache.RedisCache, frontendDir string) http.Handler {
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
