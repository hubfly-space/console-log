package handler

import (
	"net/http"
	"time"

	"github.com/bonheur/go-starter-kit/internal/database"
)

// APIHandler provides sample API endpoints.
type APIHandler struct {
	db *database.DB
}

// NewAPIHandler creates a new API handler.
func NewAPIHandler(db *database.DB) *APIHandler {
	return &APIHandler{db: db}
}

// HandleHello is a sample endpoint: GET /api/hello
func (a *APIHandler) HandleHello(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	name := r.URL.Query().Get("name")
	if name == "" {
		name = "World"
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":   "Hello, " + name + "!",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// HandleReadiness is a lightweight readiness probe: GET /readyz
func (a *APIHandler) HandleReadiness(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ready",
	})
}
