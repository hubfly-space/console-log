// Package router sets up the HTTP router with all routes and middleware.
package router

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/bonheur/go-starter-kit/internal/bridge"
	"github.com/bonheur/go-starter-kit/internal/config"
	"github.com/bonheur/go-starter-kit/internal/handler"
	"github.com/bonheur/go-starter-kit/internal/middleware"
)

// New creates and configures the HTTP router with all routes and middleware.
func New(cfg *config.Config, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()

	// --- Handlers ---
	healthHandler := handler.NewHealthHandler()
	apiHandler := handler.NewAPIHandler()

	// --- GoBridge setup ---
	bridgeRegistry := bridge.NewRegistry(logger)
	bridge.Register(bridgeRegistry, "login", apiHandler.Login, "Authenticates a user and returns a token.")
	bridge.Register(bridgeRegistry, "hello", apiHandler.Hello, "Returns a greeting message.")

	// Auto-generate Typescript types in development
	if cfg.IsDevelopment() {
		err := bridgeRegistry.GenerateTypescript("web/src/lib/bridge.ts")
		if err != nil {
			logger.Error("failed to generate bridge types", slog.String("error", err.Error()))
		} else {
			logger.Info("bridge types generated", slog.String("path", "web/src/lib/bridge.ts"))
		}
	}

	// --- API Routes ---
	mux.HandleFunc("/healthz", healthHandler.ServeHTTP)
	mux.HandleFunc("/readyz", apiHandler.HandleReadiness)
	mux.HandleFunc("/version", handler.VersionHandler)
	mux.HandleFunc("/api/hello", apiHandler.HandleHello)
	
	// Bridge endpoint
	mux.Handle("/api/v1/bridge/", http.StripPrefix("/api/v1/bridge/", bridgeRegistry))

	// --- Middleware Stack ---
	// Build middleware chain (outermost first)
	middlewares := []middleware.Middleware{
		middleware.RequestID,
		middleware.Recovery(logger),
		middleware.Logging(logger),
		middleware.Security,
		middleware.CORS(middleware.CORSConfig{
			AllowedOrigins: cfg.CORSAllowedOrigins,
			AllowedMethods: cfg.CORSAllowedMethods,
			AllowedHeaders: cfg.CORSAllowedHeaders,
			MaxAge:         fmt.Sprintf("%d", cfg.CORSMaxAge),
		}),
	}

	// Add rate limiting if enabled
	if cfg.RateLimitEnabled {
		middlewares = append(middlewares, middleware.RateLimit(cfg.RateLimitRPS, cfg.RateLimitBurst))
	}

	// Add compression if enabled
	if cfg.CompressionEnabled {
		middlewares = append(middlewares, middleware.Compress(cfg.CompressionLevel))
	}

	chain := middleware.Chain(middlewares...)

	return chain(mux)
}
