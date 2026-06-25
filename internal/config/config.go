// Package config provides environment-based configuration for the server.
// All configuration is loaded from environment variables with sensible defaults.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all server configuration.
type Config struct {
	// Server settings
	Host            string
	Port            int
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration

	// Application settings
	AppName     string
	Environment string // development, staging, production
	LogLevel    string // debug, info, warn, error
	LogFormat   string // text, json

	// CORS settings
	CORSAllowedOrigins []string
	CORSAllowedMethods []string
	CORSAllowedHeaders []string
	CORSMaxAge         int

	// Rate limiting
	RateLimitEnabled bool
	RateLimitRPS     float64
	RateLimitBurst   int

	// Compression
	CompressionEnabled bool
	CompressionLevel   int

	// Frontend
	ServeFrontend bool

	// Database
	DBPath         string
	DBBusyTimeout  int
}

// New creates a new Config with values from environment variables,
// falling back to sensible defaults.
func New() *Config {
	return &Config{
		Host:            envString("SERVER_HOST", "0.0.0.0"),
		Port:            envInt("SERVER_PORT", 8080),
		ReadTimeout:     envDuration("SERVER_READ_TIMEOUT", 15*time.Second),
		WriteTimeout:    envDuration("SERVER_WRITE_TIMEOUT", 15*time.Second),
		IdleTimeout:     envDuration("SERVER_IDLE_TIMEOUT", 60*time.Second),
		ShutdownTimeout: envDuration("SERVER_SHUTDOWN_TIMEOUT", 30*time.Second),

		AppName:     envString("APP_NAME", "go-starter-kit"),
		Environment: envString("APP_ENV", "development"),
		LogLevel:    envString("LOG_LEVEL", "info"),
		LogFormat:   envString("LOG_FORMAT", "text"),

		CORSAllowedOrigins: envStringSlice("CORS_ALLOWED_ORIGINS", []string{"*"}),
		CORSAllowedMethods: envStringSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}),
		CORSAllowedHeaders: envStringSlice("CORS_ALLOWED_HEADERS", []string{"Content-Type", "Authorization", "X-Request-ID"}),
		CORSMaxAge:         envInt("CORS_MAX_AGE", 86400),

		RateLimitEnabled: envBool("RATE_LIMIT_ENABLED", true),
		RateLimitRPS:     envFloat("RATE_LIMIT_RPS", 100),
		RateLimitBurst:   envInt("RATE_LIMIT_BURST", 200),

		CompressionEnabled: envBool("COMPRESSION_ENABLED", true),
		CompressionLevel:   envInt("COMPRESSION_LEVEL", 5),

		ServeFrontend: envBool("SERVE_FRONTEND", true),

		DBPath:        envString("DB_PATH", "data/app.db"),
		DBBusyTimeout: envInt("DB_BUSY_TIMEOUT", 5000),
	}
}

// Addr returns the server listen address.
func (c *Config) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

// IsDevelopment returns true if running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsProduction returns true if running in production mode.
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

// --- Helper functions ---

func envString(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func envFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

func envStringSlice(key string, fallback []string) []string {
	if v := os.Getenv(key); v != "" {
		parts := strings.Split(v, ",")
		result := make([]string, 0, len(parts))
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				result = append(result, trimmed)
			}
		}
		return result
	}
	return fallback
}
