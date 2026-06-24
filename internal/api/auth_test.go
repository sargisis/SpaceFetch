package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
	"github.com/sargisis/spacefetch/internal/models"
)

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

	// Clean up previous test database collections & keys
	_ = db.Close() // close connection before dropping, or just clean collections
	db, _ = database.NewMongoDB("mongodb://localhost:27017", "spacefetch_test")

	// Set up router
	router := NewRouter(db, rcache)

	// Step 1: Register a new user
	regReq := models.UserRegisterRequest{
		Email: "dev@spacefetch.com",
		Tier:  "free",
	}
	reqBody, _ := json.Marshal(regReq)
	req := httptest.NewRequest("POST", "/v1/users", bytes.NewBuffer(reqBody))
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
