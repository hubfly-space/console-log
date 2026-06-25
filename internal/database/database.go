// Package database provides a production-ready SQLite database layer
// with WAL mode, connection pooling, automatic migrations, and health checks.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	// Pure Go SQLite driver — no CGO required.
	_ "modernc.org/sqlite"
)

// DB wraps a sql.DB with application-specific helpers.
type DB struct {
	*sql.DB
	logger *slog.Logger
	path   string
}

// Config holds database configuration options.
type Config struct {
	// Path to the SQLite database file. Use ":memory:" for in-memory databases.
	Path string
	// MaxOpenConns sets the max number of open connections (default: 1 for WAL writer).
	MaxOpenConns int
	// MaxIdleConns sets the max number of idle connections (default: 2).
	MaxIdleConns int
	// ConnMaxLifetime sets the max lifetime of a connection (default: 30m).
	ConnMaxLifetime time.Duration
	// BusyTimeout sets the SQLite busy timeout in milliseconds (default: 5000).
	BusyTimeout int
}

// DefaultConfig returns a Config with sensible defaults for production use.
func DefaultConfig() Config {
	return Config{
		Path:            "data/app.db",
		MaxOpenConns:    1,
		MaxIdleConns:    2,
		ConnMaxLifetime: 30 * time.Minute,
		BusyTimeout:     5000,
	}
}

// Open creates a new database connection with WAL mode and recommended
// pragmas for production SQLite usage.
//
// Pragmas applied:
//   - journal_mode=WAL     — Write-Ahead Logging for concurrent reads
//   - busy_timeout=5000    — Wait up to 5s instead of failing immediately
//   - synchronous=NORMAL   — Safe with WAL, better performance than FULL
//   - cache_size=-20000    — 20MB page cache
//   - foreign_keys=ON      — Enforce foreign key constraints
//   - temp_store=MEMORY    — Keep temp tables in memory
//   - mmap_size=268435456  — 256MB memory-mapped I/O
func Open(cfg Config, logger *slog.Logger) (*DB, error) {
	if cfg.Path == "" {
		cfg = DefaultConfig()
	}
	if cfg.MaxOpenConns == 0 {
		cfg.MaxOpenConns = 1
	}
	if cfg.MaxIdleConns == 0 {
		cfg.MaxIdleConns = 2
	}
	if cfg.ConnMaxLifetime == 0 {
		cfg.ConnMaxLifetime = 30 * time.Minute
	}
	if cfg.BusyTimeout == 0 {
		cfg.BusyTimeout = 5000
	}

	// Build DSN with pragmas baked in via query parameters.
	dsn := fmt.Sprintf(
		"%s?_pragma=busy_timeout(%d)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=cache_size(-20000)&_pragma=foreign_keys(ON)&_pragma=temp_store(MEMORY)&_pragma=mmap_size(268435456)",
		cfg.Path,
		cfg.BusyTimeout,
	)

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("database open: %w", err)
	}

	// Connection pool settings.
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Verify the connection works.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("database ping: %w", err)
	}

	// Verify WAL mode is active.
	var journalMode string
	if err := db.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&journalMode); err != nil {
		db.Close()
		return nil, fmt.Errorf("database pragma check: %w", err)
	}

	logger.Info("database connected",
		slog.String("path", cfg.Path),
		slog.String("journal_mode", journalMode),
		slog.Int("busy_timeout_ms", cfg.BusyTimeout),
		slog.Int("max_open_conns", cfg.MaxOpenConns),
	)

	return &DB{
		DB:     db,
		logger: logger,
		path:   cfg.Path,
	}, nil
}

// Health returns database health information for the /healthz endpoint.
func (d *DB) Health(ctx context.Context) map[string]any {
	result := map[string]any{
		"status": "down",
		"path":   d.path,
	}

	start := time.Now()
	if err := d.PingContext(ctx); err != nil {
		result["error"] = err.Error()
		return result
	}

	result["status"] = "up"
	result["latency_ms"] = time.Since(start).Milliseconds()

	// Get database stats.
	stats := d.Stats()
	result["open_connections"] = stats.OpenConnections
	result["in_use"] = stats.InUse
	result["idle"] = stats.Idle

	// Get database file size.
	var pageCount, pageSize int64
	if err := d.QueryRowContext(ctx, "PRAGMA page_count").Scan(&pageCount); err == nil {
		if err := d.QueryRowContext(ctx, "PRAGMA page_size").Scan(&pageSize); err == nil {
			sizeMB := float64(pageCount*pageSize) / (1024 * 1024)
			result["size_mb"] = fmt.Sprintf("%.2f", sizeMB)
		}
	}

	// Get WAL status.
	var walPages int64
	if err := d.QueryRowContext(ctx, "PRAGMA wal_checkpoint(PASSIVE)").Scan(new(int64), &walPages, new(int64)); err == nil {
		result["wal_pages"] = walPages
	}

	return result
}
