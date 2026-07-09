package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/sargisis/spacefetch/internal/models"
)

const (
	sessionCookieName = "sf_session"
	sessionTTL        = 7 * 24 * time.Hour
	minPasswordLen    = 8
	// bcrypt silently truncates input beyond 72 bytes
	maxPasswordLen = 72
)

func generateSessionID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (h *Handler) setSessionCookie(w http.ResponseWriter, sessionID string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionID,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   h.secureCookies,
		SameSite: http.SameSiteLaxMode,
	})
}

// startSession creates a Redis-backed session and sets the httpOnly cookie.
func (h *Handler) startSession(w http.ResponseWriter, r *http.Request, email string) error {
	sessionID, err := generateSessionID()
	if err != nil {
		return err
	}
	if err := h.cache.CreateSession(r.Context(), sessionID, email, sessionTTL); err != nil {
		return err
	}
	h.setSessionCookie(w, sessionID, int(sessionTTL.Seconds()))
	return nil
}

// sessionUser resolves the current user from the session cookie.
// Returns nil (without writing a response) when there is no valid session.
func (h *Handler) sessionUser(r *http.Request) *models.User {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil || cookie.Value == "" {
		return nil
	}

	email, ok, err := h.cache.GetSession(r.Context(), cookie.Value)
	if err != nil {
		log.Printf("auth: session lookup error: %v", err)
		return nil
	}
	if !ok {
		return nil
	}

	user, err := h.db.GetUserByEmail(r.Context(), email)
	if err != nil {
		return nil
	}
	return user
}

func validatePassword(password string) (string, bool) {
	if len(password) < minPasswordLen {
		return "password must be at least 8 characters", false
	}
	if len(password) > maxPasswordLen {
		return "password must be at most 72 characters", false
	}
	return "", true
}

// AuthRegister handles POST /v1/auth/register: creates an account with a
// password, returns the API key (shown exactly once) and starts a session.
func (h *Handler) AuthRegister(w http.ResponseWriter, r *http.Request) {
	var req models.AuthRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if !emailRegex.MatchString(req.Email) {
		writeError(w, http.StatusBadRequest, "invalid email format")
		return
	}
	if msg, ok := validatePassword(req.Password); !ok {
		writeError(w, http.StatusBadRequest, msg)
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

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	apiKey, err := generateSecureAPIKey()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate api key")
		return
	}

	user, err := h.db.CreateUser(r.Context(), req.Email, hashAPIKey(apiKey), string(passwordHash), tier)
	if err != nil {
		writeError(w, http.StatusConflict, "email already registered")
		return
	}

	if err := h.startSession(w, r, user.Email); err != nil {
		log.Printf("auth: failed to start session after register: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(models.UserRegisterResponse{
		Status: "success",
		Email:  user.Email,
		APIKey: apiKey,
		Tier:   user.Tier,
	})
}

// AuthLogin handles POST /v1/auth/login: verifies email+password and starts
// a cookie session. The API key is never returned here.
func (h *Handler) AuthLogin(w http.ResponseWriter, r *http.Request) {
	var req models.AuthLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	user, err := h.db.GetUserByEmail(r.Context(), req.Email)
	// Accounts registered through the key-only developer endpoint have no
	// password; treat them the same as a wrong password to avoid leaking
	// which emails exist.
	if err != nil || user.PasswordHash == "" ||
		bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if err := h.startSession(w, r, user.Email); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.AuthSessionResponse{
		Status: "success",
		Email:  user.Email,
		Tier:   user.Tier,
	})
}

// AuthLogout handles POST /v1/auth/logout.
func (h *Handler) AuthLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil && cookie.Value != "" {
		if err := h.cache.DeleteSession(r.Context(), cookie.Value); err != nil {
			log.Printf("auth: failed to delete session: %v", err)
		}
	}
	h.setSessionCookie(w, "", -1)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// AuthMe handles GET /v1/auth/me: restores the console session on page load.
func (h *Handler) AuthMe(w http.ResponseWriter, r *http.Request) {
	user := h.sessionUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.AuthSessionResponse{
		Status: "success",
		Email:  user.Email,
		Tier:   user.Tier,
	})
}

// AuthRegenerateKey handles POST /v1/auth/regenerate-key: rotates the API key
// for the logged-in user and returns the new key (shown exactly once).
func (h *Handler) AuthRegenerateKey(w http.ResponseWriter, r *http.Request) {
	user := h.sessionUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	apiKey, err := generateSecureAPIKey()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate api key")
		return
	}

	if err := h.db.UpdateAPIKeyHash(r.Context(), user.Email, hashAPIKey(apiKey)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rotate api key")
		return
	}

	// Drop the cached entry for the old key so it stops working immediately
	if err := h.cache.DeleteUserCache(r.Context(), user.HashedAPIKey); err != nil {
		log.Printf("auth: failed to invalidate old key cache: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.RegenerateKeyResponse{
		Status: "success",
		APIKey: apiKey,
	})
}

// clientIP extracts the caller's IP for per-IP rate limiting, preferring the
// first X-Forwarded-For hop when running behind a proxy.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if first, _, ok := strings.Cut(xff, ","); ok {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
