package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

// IngestEvent represents a single telemetry event sent to the platform.
type IngestEvent struct {
	Type      string         `json:"type"`                // 'log', 'metric', 'error'
	Timestamp string         `json:"timestamp,omitempty"` // ISO8601 string, optional
	Level     string         `json:"level,omitempty"`     // info, warn, error, debug, fatal
	Message   string         `json:"message"`             // Main descriptive message
	Payload   map[string]any `json:"payload,omitempty"`   // Arbitrary key-value metrics/logs context
}

// HandleIngest processes POST /api/v1/ingest requests.
func (a *APIHandler) HandleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	// 1. Extract and validate Stream Key
	streamKey := r.Header.Get("X-Stream-Key")
	if streamKey == "" {
		// Fallback to query parameter or bearer token
		streamKey = r.URL.Query().Get("stream_key")
		if streamKey == "" {
			authHeader := r.Header.Get("Authorization")
			if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
				streamKey = authHeader[7:]
			}
		}
	}

	if streamKey == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Missing stream key"})
		return
	}

	// Look up stream in database
	var streamID int
	var projectID int
	err := a.db.QueryRowContext(r.Context(), `
		SELECT id, project_id FROM streams WHERE stream_key = ?`, streamKey).Scan(&streamID, &projectID)

	if err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid stream key"})
		} else {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		}
		return
	}

	// 2. Decode Payload (can be a single event or a JSON array of events)
	var events []IngestEvent

	// We decode raw message to inspect whether it's an array or a single object
	var rawBody json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON payload"})
		return
	}

	// Check if array
	if rawBody[0] == '[' {
		if err := json.Unmarshal(rawBody, &events); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid events array format"})
			return
		}
	} else {
		var singleEvent IngestEvent
		if err := json.Unmarshal(rawBody, &singleEvent); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid event format"})
			return
		}
		events = append(events, singleEvent)
	}

	if len(events) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "No events provided"})
		return
	}

	// 3. Batch Insert inside a single database transaction
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to initialize transaction"})
		return
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(r.Context(), `
		INSERT INTO events (project_id, stream_id, type, timestamp, level, message, payload, error_group)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to prepare query"})
		return
	}
	defer stmt.Close()

	now := time.Now().UTC()

	for _, ev := range events {
		// Validation & defaults
		if ev.Type != "log" && ev.Type != "metric" && ev.Type != "error" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid event type (must be 'log', 'metric', or 'error')"})
			return
		}

		// Timestamp validation/fallback
		ts := ev.Timestamp
		if ts == "" {
			ts = now.Format(time.RFC3339)
		} else {
			// Check if valid RFC3339, else fallback
			if _, err := time.Parse(time.RFC3339, ts); err != nil {
				ts = now.Format(time.RFC3339)
			}
		}

		// Level default
		level := ev.Level
		if level == "" {
			level = "info"
		}

		// Payload default & serialization
		payloadMap := ev.Payload
		if payloadMap == nil {
			payloadMap = make(map[string]any)
		}
		payloadBytes, err := json.Marshal(payloadMap)
		if err != nil {
			payloadBytes = []byte("{}")
		}

		// Exception Intelligence: Group error types by message
		errorGroup := ""
		if ev.Type == "error" {
			errorGroup = ev.Message
			// Optional: Truncate very long messages or clean up dynamic values like memory addresses
			if len(errorGroup) > 255 {
				errorGroup = errorGroup[:255]
			}
		}

		_, err = stmt.ExecContext(r.Context(),
			projectID,
			streamID,
			ev.Type,
			ts,
			level,
			ev.Message,
			string(payloadBytes),
			errorGroup,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to write event"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to commit events"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"inserted": len(events),
	})
}
