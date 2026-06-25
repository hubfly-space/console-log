package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/bonheur/go-starter-kit/internal/database"
)

func TestHandleIngest(t *testing.T) {
	// Create test logger
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))

	// Setup clean in-memory database
	db, err := database.Open(database.Config{Path: ":memory:"}, logger)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(context.Background(), database.DefaultMigrations); err != nil {
		t.Fatalf("failed to run migrations: %v", err)
	}

	// Create test project and stream
	var projectID int
	err = db.QueryRowContext(context.Background(), `
		INSERT INTO projects (name, api_key) VALUES ('Test Project', 'pk_test') RETURNING id`).Scan(&projectID)
	if err != nil {
		t.Fatalf("failed to insert test project: %v", err)
	}

	var streamID int
	err = db.QueryRowContext(context.Background(), `
		INSERT INTO streams (project_id, name, stream_key) VALUES (?, 'API Logs', 'sk_test') RETURNING id`, projectID).Scan(&streamID)
	if err != nil {
		t.Fatalf("failed to insert test stream: %v", err)
	}

	api := NewAPIHandler(db)

	t.Run("Missing Stream Key", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest", bytes.NewBufferString(`{}`))
		rec := httptest.NewRecorder()

		api.HandleIngest(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("Invalid Stream Key", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest", bytes.NewBufferString(`{}`))
		req.Header.Set("X-Stream-Key", "invalid_key")
		rec := httptest.NewRecorder()

		api.HandleIngest(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
		}
	})

	t.Run("Single Event Ingest Success", func(t *testing.T) {
		payload := IngestEvent{
			Type:    "log",
			Message: "Successful authentication",
			Level:   "info",
			Payload: map[string]any{"user_id": 42},
		}
		body, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest", bytes.NewReader(body))
		req.Header.Set("X-Stream-Key", "sk_test")
		rec := httptest.NewRecorder()

		api.HandleIngest(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d. Body: %s", http.StatusOK, rec.Code, rec.Body.String())
		}

		// Verify event was saved in database
		var count int
		err := db.QueryRowContext(context.Background(), "SELECT COUNT(*) FROM events").Scan(&count)
		if err != nil {
			t.Fatalf("failed to query events count: %v", err)
		}
		if count != 1 {
			t.Errorf("expected 1 event in database, got %d", count)
		}
	})

	t.Run("Bulk Event Ingest Success", func(t *testing.T) {
		payloads := []IngestEvent{
			{
				Type:    "metric",
				Message: "cpu_usage",
				Payload: map[string]any{"value": 85.5},
			},
			{
				Type:    "error",
				Message: "NullPointer exception in login flow",
				Level:   "error",
				Payload: map[string]any{"stack": "auth.js:55"},
			},
		}
		body, _ := json.Marshal(payloads)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest", bytes.NewReader(body))
		req.Header.Set("X-Stream-Key", "sk_test")
		rec := httptest.NewRecorder()

		api.HandleIngest(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d. Body: %s", http.StatusOK, rec.Code, rec.Body.String())
		}

		// Verify events count (should be 1 + 2 = 3 now)
		var count int
		db.QueryRowContext(context.Background(), "SELECT COUNT(*) FROM events").Scan(&count)
		if count != 3 {
			t.Errorf("expected 3 events in database, got %d", count)
		}
	})
}
