// Package server provides a production-ready HTTP server with graceful shutdown.
package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/bonheur/go-starter-kit/internal/config"
)

// Server wraps the standard library HTTP server with graceful shutdown.
type Server struct {
	httpServer *http.Server
	cfg        *config.Config
	logger     *slog.Logger
}

// New creates a new Server.
func New(cfg *config.Config, handler http.Handler, logger *slog.Logger) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:         cfg.Addr(),
			Handler:      handler,
			ReadTimeout:  cfg.ReadTimeout,
			WriteTimeout: cfg.WriteTimeout,
			IdleTimeout:  cfg.IdleTimeout,
			MaxHeaderBytes: 1 << 20, // 1MB
		},
		cfg:    cfg,
		logger: logger,
	}
}

// Start starts the HTTP server and blocks until shutdown.
// It listens for SIGINT/SIGTERM to perform graceful shutdown.
func (s *Server) Start() error {
	// Channel to receive server errors
	errCh := make(chan error, 1)

	// Start server in a goroutine
	go func() {
		s.logger.Info("server starting",
			slog.String("addr", s.cfg.Addr()),
			slog.String("env", s.cfg.Environment),
		)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- fmt.Errorf("server listen error: %w", err)
		}
	}()

	// Wait for interrupt signal or server error
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case sig := <-quit:
		s.logger.Info("shutdown signal received", slog.String("signal", sig.String()))
	}

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.ShutdownTimeout)
	defer cancel()

	s.logger.Info("shutting down gracefully",
		slog.Duration("timeout", s.cfg.ShutdownTimeout),
	)

	if err := s.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("server forced to shutdown: %w", err)
	}

	s.logger.Info("server stopped")
	return nil
}
