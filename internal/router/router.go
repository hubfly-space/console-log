// Package router sets up the HTTP router with all routes and middleware.
package router

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/bonheur/go-starter-kit/internal/bridge"
	"github.com/bonheur/go-starter-kit/internal/config"
	"github.com/bonheur/go-starter-kit/internal/database"
	"github.com/bonheur/go-starter-kit/internal/handler"
	"github.com/bonheur/go-starter-kit/internal/middleware"
)

// New creates and configures the HTTP router with all routes and middleware.
func New(cfg *config.Config, logger *slog.Logger, db *database.DB) http.Handler {
	mux := http.NewServeMux()

	// --- Handlers ---
	healthHandler := handler.NewHealthHandler()
	apiHandler := handler.NewAPIHandler(db)

	// --- GoBridge setup ---
	bridgeRegistry := bridge.NewRegistry(logger)
	
	// Authentication RPCs
	bridge.Register(bridgeRegistry, "signup", apiHandler.SignUp, "Registers a new user.")
	bridge.Register(bridgeRegistry, "login", apiHandler.Login, "Authenticates a user and returns a token.")
	bridge.Register(bridgeRegistry, "logout", apiHandler.Logout, "Logs out a user and invalidates their session.")
	bridge.Register(bridgeRegistry, "getCurrentUser", apiHandler.GetCurrentUser, "Returns the current authenticated user.")
	
	// Project/Stream management RPCs
	bridge.Register(bridgeRegistry, "createProject", apiHandler.CreateProject, "Creates a new project.")
	bridge.Register(bridgeRegistry, "listProjects", apiHandler.ListProjects, "Lists all projects.")
	bridge.Register(bridgeRegistry, "createStream", apiHandler.CreateStream, "Creates a new ingestion stream.")
	bridge.Register(bridgeRegistry, "listStreams", apiHandler.ListStreams, "Lists all streams for a project.")
	
	// Observability RPCs
	bridge.Register(bridgeRegistry, "queryLogs", apiHandler.QueryLogs, "Queries log events with filters.")
	bridge.Register(bridgeRegistry, "getLogHistogram", apiHandler.GetLogHistogram, "Gets log count distribution over time.")
	bridge.Register(bridgeRegistry, "queryErrors", apiHandler.QueryErrors, "Queries grouped error events.")
	bridge.Register(bridgeRegistry, "getErrorDetails", apiHandler.GetErrorDetails, "Gets error detail events.")
	bridge.Register(bridgeRegistry, "queryMetrics", apiHandler.QueryMetrics, "Queries metrics data over time.")
	bridge.Register(bridgeRegistry, "generateDemoData", apiHandler.GenerateDemoData, "Generates demo logs, metrics, and errors.")

	// Alerts RPCs
	bridge.Register(bridgeRegistry, "createAlertRule", apiHandler.CreateAlertRule, "Creates a new alert rule.")
	bridge.Register(bridgeRegistry, "listAlertRules", apiHandler.ListAlertRules, "Lists all alert rules for a project.")
	bridge.Register(bridgeRegistry, "toggleAlertRule", apiHandler.ToggleAlertRule, "Toggles an alert rule active state.")
	bridge.Register(bridgeRegistry, "deleteAlertRule", apiHandler.DeleteAlertRule, "Deletes an alert rule.")
	bridge.Register(bridgeRegistry, "queryAlertsHistory", apiHandler.QueryAlertsHistory, "Queries alerts trigger history.")

	// Dashboard Builder RPCs
	bridge.Register(bridgeRegistry, "saveDashboard", apiHandler.SaveDashboard, "Saves a dashboard layout configuration.")
	bridge.Register(bridgeRegistry, "getDashboards", apiHandler.GetDashboards, "Gets dashboards for a project.")

	// Incident Management RPCs
	bridge.Register(bridgeRegistry, "createIncident", apiHandler.CreateIncident, "Creates a new incident.")
	bridge.Register(bridgeRegistry, "updateIncidentStatus", apiHandler.UpdateIncidentStatus, "Updates incident status and logs updates.")
	bridge.Register(bridgeRegistry, "listIncidents", apiHandler.ListIncidents, "Lists incidents for a project.")

	// Audit Trail RPCs
	bridge.Register(bridgeRegistry, "queryAuditLogs", apiHandler.QueryAuditLogs, "Queries system audit logs.")

	// Test/Demo RPCs
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
	mux.HandleFunc("/api/v1/ingest", apiHandler.HandleIngest)
	
	// Bridge endpoint (wrapped with authentication middleware)
	mux.Handle("/api/v1/bridge/", middleware.Authenticate(db)(http.StripPrefix("/api/v1/bridge/", bridgeRegistry)))

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
