package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bonheur/go-starter-kit/internal/middleware"
)

func TestRequestID(t *testing.T) {
	handler := middleware.RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("generates request ID when not present", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		id := rec.Header().Get("X-Request-ID")
		if id == "" {
			t.Error("expected X-Request-ID header to be set")
		}
		if len(id) != 32 {
			t.Errorf("expected 32 char request ID, got %d chars: %s", len(id), id)
		}
	})

	t.Run("preserves existing request ID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("X-Request-ID", "test-id-123")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		id := rec.Header().Get("X-Request-ID")
		if id != "test-id-123" {
			t.Errorf("expected 'test-id-123', got '%s'", id)
		}
	})
}

func TestChain(t *testing.T) {
	var order []string

	mw1 := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "mw1-before")
			next.ServeHTTP(w, r)
			order = append(order, "mw1-after")
		})
	}

	mw2 := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order = append(order, "mw2-before")
			next.ServeHTTP(w, r)
			order = append(order, "mw2-after")
		})
	}

	chain := middleware.Chain(mw1, mw2)
	handler := chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		order = append(order, "handler")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	expected := []string{"mw1-before", "mw2-before", "handler", "mw2-after", "mw1-after"}
	if len(order) != len(expected) {
		t.Fatalf("expected %d calls, got %d", len(expected), len(order))
	}
	for i, v := range expected {
		if order[i] != v {
			t.Errorf("position %d: expected '%s', got '%s'", i, v, order[i])
		}
	}
}

func TestRateLimit(t *testing.T) {
	// Create a rate limiter that allows 2 requests per second with burst of 2
	limiter := middleware.RateLimit(2, 2)
	handler := limiter(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First 2 requests should succeed (burst)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "192.168.1.1:1234"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("request %d: expected 200, got %d", i+1, rec.Code)
		}
	}

	// 3rd request should be rate limited
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "192.168.1.1:1234"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429, got %d", rec.Code)
	}
}

func TestCORS(t *testing.T) {
	cors := middleware.CORS(middleware.CORSConfig{
		AllowedOrigins: []string{"http://localhost:3000"},
		AllowedMethods: []string{"GET", "POST"},
		AllowedHeaders: []string{"Content-Type"},
		MaxAge:         "3600",
	})

	handler := cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("sets CORS headers for allowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
			t.Error("expected Access-Control-Allow-Origin to be set")
		}
	})

	t.Run("handles preflight requests", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Errorf("expected 204 for preflight, got %d", rec.Code)
		}
	})
}

func TestSecurity(t *testing.T) {
	handler := middleware.Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	headers := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":       "DENY",
		"X-XSS-Protection":      "1; mode=block",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
	}

	for name, expected := range headers {
		got := rec.Header().Get(name)
		if got != expected {
			t.Errorf("header %s: expected '%s', got '%s'", name, expected, got)
		}
	}
}
