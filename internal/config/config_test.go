package config_test

import (
	"os"
	"testing"

	"github.com/bonheur/go-starter-kit/internal/config"
)

func TestNew_Defaults(t *testing.T) {
	cfg := config.New()

	if cfg.Port != 8080 {
		t.Errorf("expected default port 8080, got %d", cfg.Port)
	}

	if cfg.Host != "0.0.0.0" {
		t.Errorf("expected default host 0.0.0.0, got %s", cfg.Host)
	}

	if cfg.Environment != "development" {
		t.Errorf("expected default env 'development', got %s", cfg.Environment)
	}

	if cfg.LogLevel != "info" {
		t.Errorf("expected default log level 'info', got %s", cfg.LogLevel)
	}

	if !cfg.RateLimitEnabled {
		t.Error("expected rate limiting to be enabled by default")
	}

	if !cfg.ServeFrontend {
		t.Error("expected frontend serving to be enabled by default")
	}
}

func TestNew_EnvOverride(t *testing.T) {
	os.Setenv("SERVER_PORT", "9090")
	os.Setenv("APP_ENV", "production")
	os.Setenv("LOG_LEVEL", "error")
	defer func() {
		os.Unsetenv("SERVER_PORT")
		os.Unsetenv("APP_ENV")
		os.Unsetenv("LOG_LEVEL")
	}()

	cfg := config.New()

	if cfg.Port != 9090 {
		t.Errorf("expected port 9090, got %d", cfg.Port)
	}

	if cfg.Environment != "production" {
		t.Errorf("expected env 'production', got %s", cfg.Environment)
	}

	if cfg.LogLevel != "error" {
		t.Errorf("expected log level 'error', got %s", cfg.LogLevel)
	}
}

func TestConfig_Addr(t *testing.T) {
	cfg := config.New()
	expected := "0.0.0.0:8080"
	if cfg.Addr() != expected {
		t.Errorf("expected addr '%s', got '%s'", expected, cfg.Addr())
	}
}

func TestConfig_IsDevelopment(t *testing.T) {
	cfg := config.New()
	if !cfg.IsDevelopment() {
		t.Error("expected IsDevelopment() to be true in default config")
	}
}

func TestConfig_IsProduction(t *testing.T) {
	os.Setenv("APP_ENV", "production")
	defer os.Unsetenv("APP_ENV")

	cfg := config.New()
	if !cfg.IsProduction() {
		t.Error("expected IsProduction() to be true when APP_ENV=production")
	}
}
