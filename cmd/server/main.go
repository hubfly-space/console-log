package main

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/bonheur/go-starter-kit/internal/config"
	"github.com/bonheur/go-starter-kit/internal/database"
	"github.com/bonheur/go-starter-kit/internal/router"
	"github.com/bonheur/go-starter-kit/internal/server"
)

// frontendFS is set by embed.go when building with the frontend embedded.
// When nil, the server will not serve frontend files.
var frontendFS fs.FS

func main() {
	// Load configuration
	cfg := config.New()

	// Setup structured logger
	logger := setupLogger(cfg)

	// Ensure data directory exists for SQLite.
	if dir := filepath.Dir(cfg.DBPath); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			logger.Error("failed to create data directory", slog.String("path", dir), slog.String("error", err.Error()))
			os.Exit(1)
		}
	}

	// Open database with WAL mode.
	db, err := database.Open(database.Config{
		Path:        cfg.DBPath,
		BusyTimeout: cfg.DBBusyTimeout,
	}, logger)
	if err != nil {
		logger.Error("database open failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	// Run migrations.
	if err := db.Migrate(context.Background(), database.DefaultMigrations); err != nil {
		logger.Error("database migration failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// Create router
	handler := router.New(cfg, logger)

	// Wrap with frontend serving if embedded and enabled
	if cfg.ServeFrontend && frontendFS != nil {
		handler = serveFrontend(handler, frontendFS, logger)
	}

	// Create and start server
	srv := server.New(cfg, handler, logger)
	if err := srv.Start(); err != nil {
		logger.Error("server error", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

// setupLogger creates a structured logger based on configuration.
func setupLogger(cfg *config.Config) *slog.Logger {
	var level slog.Level
	switch strings.ToLower(cfg.LogLevel) {
	case "debug":
		level = slog.LevelDebug
	case "info":
		level = slog.LevelInfo
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level:     level,
		AddSource: cfg.IsDevelopment(),
	}

	var handler slog.Handler
	if cfg.LogFormat == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	logger := slog.New(handler)
	slog.SetDefault(logger)

	return logger
}

// serveFrontend wraps the API handler to also serve embedded frontend files.
// API routes (/api/*, /healthz, /readyz, /version) are handled by the API handler.
// All other routes serve the frontend SPA (with index.html fallback for client-side routing).
func serveFrontend(apiHandler http.Handler, frontendFS fs.FS, logger *slog.Logger) http.Handler {
	fileServer := http.FileServer(http.FS(frontendFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Route API endpoints to the API handler
		path := r.URL.Path
		if strings.HasPrefix(path, "/api/") ||
			path == "/healthz" ||
			path == "/readyz" ||
			path == "/version" {
			apiHandler.ServeHTTP(w, r)
			return
		}

		// Try to serve static file
		if path != "/" {
			// Check if file exists in the embedded FS
			filePath := strings.TrimPrefix(path, "/")
			if f, err := frontendFS.Open(filePath); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// Fallback to index.html for SPA routing
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
