package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bonheur/go-starter-kit/internal/handler"
)

func TestHealthHandler_ServeHTTP(t *testing.T) {
	h := handler.NewHealthHandler()

	t.Run("returns 200 OK with health data", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		rec := httptest.NewRecorder()

		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		contentType := rec.Header().Get("Content-Type")
		if contentType != "application/json; charset=utf-8" {
			t.Errorf("expected content-type application/json, got %s", contentType)
		}

		var resp map[string]any
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp["status"] != "ok" {
			t.Errorf("expected status 'ok', got '%v'", resp["status"])
		}

		if resp["uptime"] == nil {
			t.Error("expected uptime to be present")
		}

		if resp["system"] == nil {
			t.Error("expected system info to be present")
		}
	})

	t.Run("rejects non-GET methods", func(t *testing.T) {
		methods := []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch}
		for _, method := range methods {
			req := httptest.NewRequest(method, "/healthz", nil)
			rec := httptest.NewRecorder()

			h.ServeHTTP(rec, req)

			if rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("[%s] expected status 405, got %d", method, rec.Code)
			}
		}
	})
}

func TestHealthHandler_IncrementRequests(t *testing.T) {
	h := handler.NewHealthHandler()

	// Increment a few times
	for i := 0; i < 5; i++ {
		h.IncrementRequests()
	}

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	var resp map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	stats := resp["stats"].(map[string]any)
	totalRequests := stats["total_requests"].(float64)
	if totalRequests != 5 {
		t.Errorf("expected 5 total requests, got %v", totalRequests)
	}
}
