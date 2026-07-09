package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
)

func setupTestHandler(t *testing.T) (*Handler, *database.MongoDB, *cache.RedisCache) {
	t.Helper()

	db, err := database.NewMongoDB("mongodb://localhost:27017", "spacefetch_test")
	if err != nil {
		t.Skip("Skipping: local MongoDB not available:", err)
	}
	db.CleanupTest(context.Background())

	rcache, err := cache.NewRedisCache("localhost:6379", "", 5*time.Second)
	if err != nil {
		t.Skip("Skipping: local Redis not available:", err)
	}

	return NewHandler(db, rcache, false), db, rcache
}

func TestHealthCheck(t *testing.T) {
	h, db, rcache := setupTestHandler(t)
	defer db.Close()
	defer rcache.Close()

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	h.HealthCheck(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal("invalid JSON response:", err)
	}
	if body["status"] != "ok" {
		t.Errorf("expected status ok, got %v", body["status"])
	}
	checks := body["checks"].(map[string]interface{})
	if checks["mongodb"] != "ok" {
		t.Errorf("expected mongodb ok, got %v", checks["mongodb"])
	}
	if checks["redis"] != "ok" {
		t.Errorf("expected redis ok, got %v", checks["redis"])
	}
}

func TestHealthCheckDegraded(t *testing.T) {
	h, db, rcache := setupTestHandler(t)
	defer db.Close()
	defer rcache.Close()
	rcache.Close()

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	h.HealthCheck(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", rec.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal("invalid JSON response:", err)
	}
	if body["status"] != "degraded" {
		t.Errorf("expected status degraded, got %v", body["status"])
	}
}

func TestRegisterUserMissingEmail(t *testing.T) {
	h, db, rcache := setupTestHandler(t)
	defer db.Close()
	defer rcache.Close()

	body := `{"tier": "free"}`
	req := httptest.NewRequest("POST", "/v1/users", strings.NewReader(body))
	req.RemoteAddr = uniqueTestIP()
	rec := httptest.NewRecorder()
	h.RegisterUser(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing email, got %d", rec.Code)
	}
}

func TestRegisterUserInvalidEmail(t *testing.T) {
	h, db, rcache := setupTestHandler(t)
	defer db.Close()
	defer rcache.Close()

	body := `{"email": "not-an-email", "tier": "free"}`
	req := httptest.NewRequest("POST", "/v1/users", strings.NewReader(body))
	req.RemoteAddr = uniqueTestIP()
	rec := httptest.NewRecorder()
	h.RegisterUser(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid email, got %d", rec.Code)
	}
}

func TestRegisterUserInvalidTier(t *testing.T) {
	h, db, rcache := setupTestHandler(t)
	defer db.Close()
	defer rcache.Close()

	body := `{"email": "test@spacefetch.com", "tier": "enterprise"}`
	req := httptest.NewRequest("POST", "/v1/users", strings.NewReader(body))
	req.RemoteAddr = uniqueTestIP()
	rec := httptest.NewRecorder()
	h.RegisterUser(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid tier, got %d", rec.Code)
	}
}

func TestRegisterUserSuccess(t *testing.T) {
	h, db, rcache := setupTestHandler(t)
	defer db.Close()
	defer rcache.Close()

	email := "handler-test-" + time.Now().Format("150405.000000") + "@spacefetch.com"
	body := `{"email": "` + email + `", "tier": "free"}`
	req := httptest.NewRequest("POST", "/v1/users", strings.NewReader(body))
	req.RemoteAddr = uniqueTestIP()
	rec := httptest.NewRecorder()
	h.RegisterUser(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal("invalid JSON:", err)
	}
	if resp["status"] != "success" {
		t.Errorf("expected status success, got %v", resp["status"])
	}
	apiKey, ok := resp["api_key"].(string)
	if !ok || !strings.HasPrefix(apiKey, "sf_live_") {
		t.Errorf("expected valid api_key, got %v", resp["api_key"])
	}
}

func TestRegisterUserDuplicate(t *testing.T) {
	h, db, rcache := setupTestHandler(t)
	defer db.Close()
	defer rcache.Close()

	email := "duplicate-test-" + time.Now().Format("150405.000000") + "@spacefetch.com"
	body := `{"email": "` + email + `", "tier": "free"}`
	req := httptest.NewRequest("POST", "/v1/users", strings.NewReader(body))
	req.RemoteAddr = uniqueTestIP()
	rec := httptest.NewRecorder()
	h.RegisterUser(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for first registration, got %d", rec.Code)
	}

	req2 := httptest.NewRequest("POST", "/v1/users", strings.NewReader(body))
	req2.RemoteAddr = uniqueTestIP()
	rec2 := httptest.NewRecorder()
	h.RegisterUser(rec2, req2)

	if rec2.Code != http.StatusConflict {
		t.Errorf("expected 409 for duplicate email, got %d", rec2.Code)
	}
}
