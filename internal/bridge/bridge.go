package bridge

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"reflect"
	"strings"
)

// Procedure represents a single RPC-style endpoint.
type Procedure struct {
	Name        string
	Handler     any
	InputType   reflect.Type
	OutputType  reflect.Type
	Description string
}

// Registry holds all registered procedures.
type Registry struct {
	Procedures map[string]Procedure
	logger     *slog.Logger
}

// NewRegistry creates a new bridge registry.
func NewRegistry(logger *slog.Logger) *Registry {
	return &Registry{
		Procedures: make(map[string]Procedure),
		logger:     logger,
	}
}

// Register registers a new procedure.
// The handler must be a function with the signature:
// func(ctx context.Context, input In) (Out, error)
func Register[In any, Out any](r *Registry, name string, handler func(context.Context, In) (Out, error), description string) {
	inType := reflect.TypeOf((*In)(nil)).Elem()
	outType := reflect.TypeOf((*Out)(nil)).Elem()

	r.Procedures[name] = Procedure{
		Name:        name,
		Handler:     handler,
		InputType:   inType,
		OutputType:  outType,
		Description: description,
	}
}

// Handle handles the RPC request.
func (r *Registry) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Route is /api/v1/bridge/{procedureName}
	parts := strings.Split(req.URL.Path, "/")
	if len(parts) < 1 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	procName := parts[len(parts)-1]

	proc, ok := r.Procedures[procName]
	if !ok {
		http.Error(w, fmt.Sprintf("Procedure %s not found", procName), http.StatusNotFound)
		return
	}

	// Decode input
	input := reflect.New(proc.InputType).Interface()
	if err := json.NewDecoder(req.Body).Decode(input); err != nil && req.ContentLength > 0 {
		r.logger.Error("failed to decode input", slog.String("procedure", procName), slog.String("error", err.Error()))
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Call handler
	fn := reflect.ValueOf(proc.Handler)
	args := []reflect.Value{
		reflect.ValueOf(req.Context()),
		reflect.ValueOf(input).Elem(),
	}

	results := fn.Call(args)
	
	// Check for error (second return value)
	if !results[1].IsNil() {
		err := results[1].Interface().(error)
		r.logger.Error("procedure error", slog.String("procedure", procName), slog.String("error", err.Error()))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Encode output
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(results[0].Interface()); err != nil {
		r.logger.Error("failed to encode output", slog.String("procedure", procName), slog.String("error", err.Error()))
	}
}
