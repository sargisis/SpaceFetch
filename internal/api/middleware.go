package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/models"
)

type contextKey string

const (
	apiKeyCtx contextKey = "api_key"
	userCtx   contextKey = "user"
)

// AuthMiddleware authenticates a request either by API key (external
// developers, X-API-Key header) or by the httpOnly session cookie (web
// console). API keys are never accepted from URL query params — those leak
// into server logs, browser history and Referer headers.
func (h *Handler) AuthMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-API-Key")

			if key == "" {
				// No API key — fall back to the console session cookie
				if user := h.sessionUser(r); user != nil {
					ctx := context.WithValue(r.Context(), userCtx, user)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
				writeError(w, http.StatusUnauthorized, "missing X-API-Key header or session")
				return
			}

			hashedKey := hashAPIKey(key)

			// 1. Try Redis cache first
			user, cached, err := h.cache.GetUserCache(r.Context(), hashedKey)
			if err != nil {
				log.Printf("auth: redis cache error: %v", err)
			}

			if !cached {
				// 2. Cache miss — check MongoDB
				user, err = h.db.GetUserByHashedKey(r.Context(), hashedKey)
				if err != nil {
					writeError(w, http.StatusUnauthorized, "invalid API key")
					return
				}

				// 3. Set Redis cache for subsequent validation
				if err := h.cache.SetUserCache(r.Context(), hashedKey, user); err != nil {
					log.Printf("auth: failed to cache user: %v", err)
				}
			}

			ctx := context.WithValue(r.Context(), userCtx, user)
			ctx = context.WithValue(ctx, apiKeyCtx, key)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// IPRateLimitMiddleware throttles unauthenticated endpoints (registration,
// login) per client IP, so they can't be scripted to flood the database or
// brute-force passwords.
func IPRateLimitMiddleware(rcache *cache.RedisCache, name string, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			allowed, err := rcache.CheckRateLimit(r.Context(), "ip:"+name+":"+clientIP(r), limit, window)
			if err != nil {
				log.Printf("ip rate limit error: %v", err)
				writeError(w, http.StatusInternalServerError, "internal server error")
				return
			}
			if !allowed {
				writeError(w, http.StatusTooManyRequests, "too many attempts, try again later")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RateLimitMiddleware throttles authenticated endpoints (asteroid data) per
// user, based on their subscription tier. Free users are limited to 5 requests
// per second, while premium users can make up to 50 requests per second.
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
				writeError(w, http.StatusInternalServerError, "internal server error")
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

func writeError(w http.ResponseWriter, status int, message string) string {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.ErrorResponse{
		Status:  strings.ToLower(http.StatusText(status)),
		Message: message,
	})
	return message
}

// originAllowed checks whether the given origin is in the allowed set or is a
// subdomain of a configured domain suffix.
func originAllowed(origin string, allowed map[string]bool, suffixes []string) bool {
	if allowed[origin] {
		return true
	}
	if origin != "" {
		if u, err := url.Parse(origin); err == nil && u.Host != "" {
			for _, suffix := range suffixes {
				if strings.HasSuffix(u.Host, suffix) {
					return true
				}
			}
		}
	}
	return false
}

// CSRFMiddleware validates the Origin (or Referer) header on state-changing
// POST requests to prevent cross-site request forgery. API-key-authenticated
// requests (no session cookie) are not subject to CSRF and are passed through.
func CSRFMiddleware(allowed map[string]bool, suffixes []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				next.ServeHTTP(w, r)
				return
			}

			origin := r.Header.Get("Origin")
			referer := r.Header.Get("Referer")

			if origin != "" {
				if originAllowed(origin, allowed, suffixes) {
					next.ServeHTTP(w, r)
					return
				}
			} else if referer != "" {
				if originAllowed(referer, allowed, suffixes) {
					next.ServeHTTP(w, r)
					return
				}
			}

			writeError(w, http.StatusForbidden, "CSRF validation failed: missing or mismatched Origin")
		})
	}
}

// CORS middleware allows cross-origin requests from the configured frontend origin.
// Supports exact matches and wildcard subdomain matching (e.g. *.example.com).

func CORS(allowed map[string]bool, domainSuffixes []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			if originAllowed(origin, allowed, domainSuffixes) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			// Prevent cache poisoning when ACAO is dynamic
			w.Header().Set("Vary", "Origin")

			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "X-API-Key, Content-Type")
			// Let the Vite dev server (cross-origin) send the session cookie
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			// Security headers
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()")
			w.Header().Set("Content-Security-Policy",
				"default-src 'self'; "+
					"script-src 'self' 'unsafe-inline'; "+
					"style-src 'self' 'unsafe-inline'; "+
					"img-src 'self' data: https://apod.nasa.gov https://epic.gsfc.nasa.gov https://www.nasa.gov; "+
					"font-src 'self' data:; "+
					"connect-src 'self' http://localhost:* ws://localhost:*; "+
					"frame-ancestors 'none'; "+
					"form-action 'self'",
			)
			if r.TLS != nil {
				w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
