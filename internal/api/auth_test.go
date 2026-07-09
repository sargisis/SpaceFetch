package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
	"github.com/sargisis/spacefetch/internal/models"
)

// TestAuthenticationFlow is an integration test that verifies the full authentication flow, including user registration, API key validation, and rate limiting. It requires a local MongoDB and Redis instance to be running.
func TestAuthenticationFlow(t *testing.T) {
	// 1. Initialize local MongoDB & Redis for testing
	db, err := database.NewMongoDB("mongodb://localhost:27017", "spacefetch_test")
	if err != nil {
		t.Skip("Skipping integration test: local MongoDB not available:", err)
		return
	}
	defer db.Close()

	rcache, err := cache.NewRedisCache("localhost:6379", "", 5*time.Second)
	if err != nil {
		t.Skip("Skipping integration test: local Redis not available:", err)
		return
	}
	defer rcache.Close()

	// Clean up previous test database collections
	db.CleanupTest(context.Background())
	db, _ = database.NewMongoDB("mongodb://localhost:27017", "spacefetch_test")

	// Set up router
	router := NewRouter(db, rcache, "", false, nil)

	// Step 1: Register a new user (unique email per run — the test DB persists)
	regReq := models.UserRegisterRequest{
		Email: fmt.Sprintf("dev%d@spacefetch.com", time.Now().UnixNano()),
		Tier:  "free",
	}
	reqBody, _ := json.Marshal(regReq)
	req := httptest.NewRequest("POST", "/v1/users", bytes.NewBuffer(reqBody))
	req.RemoteAddr = uniqueTestIP()
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected registration status 201, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var regResp models.UserRegisterResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &regResp)

	apiKey := regResp.APIKey
	if apiKey == "" || !strings.HasPrefix(apiKey, "sf_live_") {
		t.Fatalf("expected valid API key, got %q", apiKey)
	}

	// Step 2: Try accessing asteroids without API key
	req = httptest.NewRequest("GET", "/v1/asteroids/today", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing key, got %d", rec.Code)
	}

	// Step 3: Try accessing asteroids with invalid API key
	req = httptest.NewRequest("GET", "/v1/asteroids/today", nil)
	req.Header.Set("X-API-Key", "sf_live_invalidkey123")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid key, got %d", rec.Code)
	}

	// Step 4: Access asteroids with correct API key
	req = httptest.NewRequest("GET", "/v1/asteroids/today", nil)
	req.Header.Set("X-API-Key", apiKey)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for correct key, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	// Step 5: Test Rate Limiting (Free tier allows 5 req/sec)
	// We already made 1 request, let's make 5 more rapidly.
	for i := 0; i < 5; i++ {
		req = httptest.NewRequest("GET", "/v1/asteroids/today", nil)
		req.Header.Set("X-API-Key", apiKey)
		rec = httptest.NewRecorder()
		router.ServeHTTP(rec, req)
	}

	// The 6th request in under 1 second must be rate-limited (429)
	req = httptest.NewRequest("GET", "/v1/asteroids/today", nil)
	req.Header.Set("X-API-Key", apiKey)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 Too Many Requests, got %d", rec.Code)
	}
}

// uniqueTestIP hands out a distinct RemoteAddr per request so the per-IP
// rate limits on register/login (persisted in Redis across test runs) don't
// make the suite flaky.
var testIPCounter int64

func uniqueTestIP() string {
	n := atomic.AddInt64(&testIPCounter, 1) + time.Now().UnixNano()%100_000
	return fmt.Sprintf("10.9.%d.%d:1234", (n>>8)%200+1, n%200+1)
}

// sessionCookie extracts the sf_session cookie from a recorded response.
func sessionCookie(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookieName {
			return c
		}
	}
	return nil
}

// TestSessionAuthFlow verifies the cookie-session flow used by the web
// console: register with a password, restore the session via /me, access
// protected data with the cookie alone, rotate the API key, and log out.
func TestSessionAuthFlow(t *testing.T) {
	db, err := database.NewMongoDB("mongodb://localhost:27017", "spacefetch_test")
	if err != nil {
		t.Skip("Skipping integration test: local MongoDB not available:", err)
		return
	}
	defer db.Close()

	rcache, err := cache.NewRedisCache("localhost:6379", "", 5*time.Second)
	if err != nil {
		t.Skip("Skipping integration test: local Redis not available:", err)
		return
	}
	defer rcache.Close()

	router := NewRouter(db, rcache, "", false, nil)

	email := fmt.Sprintf("console%d@spacefetch.com", time.Now().UnixNano())
	password := "supersecret123"

	// Step 1: Register with a password → API key + session cookie
	body, _ := json.Marshal(models.AuthRegisterRequest{Email: email, Password: password})
	req := httptest.NewRequest("POST", "/v1/auth/register", bytes.NewBuffer(body))
	req.RemoteAddr = uniqueTestIP()
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected registration status 201, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var regResp models.UserRegisterResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &regResp)
	if !strings.HasPrefix(regResp.APIKey, "sf_live_") {
		t.Fatalf("expected API key in register response, got %q", regResp.APIKey)
	}
	firstKey := regResp.APIKey

	cookie := sessionCookie(t, rec)
	if cookie == nil || cookie.Value == "" {
		t.Fatal("expected session cookie after registration")
	}
	if !cookie.HttpOnly {
		t.Error("session cookie must be httpOnly")
	}

	// Step 2: Weak password is rejected
	body, _ = json.Marshal(models.AuthRegisterRequest{Email: "weak" + email, Password: "short"})
	req = httptest.NewRequest("POST", "/v1/auth/register", bytes.NewBuffer(body))
	req.RemoteAddr = uniqueTestIP()
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for weak password, got %d", rec.Code)
	}

	// Step 3: /me restores the session from the cookie
	req = httptest.NewRequest("GET", "/v1/auth/me", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from /me with session, got %d. Body: %s", rec.Code, rec.Body.String())
	}
	var meResp models.AuthSessionResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &meResp)
	if meResp.Email != email {
		t.Errorf("expected /me email %q, got %q", email, meResp.Email)
	}

	// Step 4: Protected endpoint works with the cookie alone (no X-API-Key)
	req = httptest.NewRequest("GET", "/v1/asteroids/today", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 from asteroids with session cookie, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	// Step 5: Login with a wrong password fails
	body, _ = json.Marshal(models.AuthLoginRequest{Email: email, Password: "wrongpassword"})
	req = httptest.NewRequest("POST", "/v1/auth/login", bytes.NewBuffer(body))
	req.RemoteAddr = uniqueTestIP()
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong password, got %d", rec.Code)
	}

	// Step 6: Login with the correct password issues a fresh session
	body, _ = json.Marshal(models.AuthLoginRequest{Email: email, Password: password})
	req = httptest.NewRequest("POST", "/v1/auth/login", bytes.NewBuffer(body))
	req.RemoteAddr = uniqueTestIP()
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from login, got %d. Body: %s", rec.Code, rec.Body.String())
	}
	loginCookie := sessionCookie(t, rec)
	if loginCookie == nil || loginCookie.Value == "" {
		t.Fatal("expected session cookie after login")
	}

	// Step 7: Rotate the API key; the old key must stop working immediately
	req = httptest.NewRequest("POST", "/v1/auth/regenerate-key", nil)
	req.AddCookie(loginCookie)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from regenerate-key, got %d. Body: %s", rec.Code, rec.Body.String())
	}
	var keyResp models.RegenerateKeyResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &keyResp)
	if !strings.HasPrefix(keyResp.APIKey, "sf_live_") || keyResp.APIKey == firstKey {
		t.Fatalf("expected a fresh API key, got %q", keyResp.APIKey)
	}

	req = httptest.NewRequest("GET", "/v1/asteroids/today", nil)
	req.Header.Set("X-API-Key", firstKey)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for revoked key, got %d", rec.Code)
	}

	req = httptest.NewRequest("GET", "/v1/asteroids/today", nil)
	req.Header.Set("X-API-Key", keyResp.APIKey)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for rotated key, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	// Step 8: Logout invalidates the session server-side
	req = httptest.NewRequest("POST", "/v1/auth/logout", nil)
	req.AddCookie(loginCookie)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from logout, got %d", rec.Code)
	}

	req = httptest.NewRequest("GET", "/v1/auth/me", nil)
	req.AddCookie(loginCookie)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 from /me after logout, got %d", rec.Code)
	}
}
