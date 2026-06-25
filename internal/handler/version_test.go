package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bonheur/go-starter-kit/internal/handler"
)

func TestVersionHandler(t *testing.T) {
	t.Run("returns 200 OK with version info", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/version", nil)
		rec := httptest.NewRecorder()

		handler.VersionHandler(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", rec.Code)
		}

		var resp map[string]string
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		requiredFields := []string{"version", "git_commit", "git_branch", "build_time", "go_version", "os", "arch"}
		for _, field := range requiredFields {
			if _, exists := resp[field]; !exists {
				t.Errorf("missing required field: %s", field)
			}
		}
	})

	t.Run("rejects non-GET methods", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/version", nil)
		rec := httptest.NewRecorder()

		handler.VersionHandler(rec, req)

		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected status 405, got %d", rec.Code)
		}
	})
}
