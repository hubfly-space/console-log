package database

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// Migration represents a single database migration with an up function.
type Migration struct {
	// Version is a unique, incrementing identifier for this migration.
	Version int
	// Name is a human-readable description (e.g., "create_users_table").
	Name string
	// Up is the SQL to execute for this migration.
	Up string
}

// Migrate runs all pending migrations in order.
// It creates the migrations tracking table if it doesn't exist,
// and skips any migrations that have already been applied.
func (d *DB) Migrate(ctx context.Context, migrations []Migration) error {
	// Create the migrations tracking table.
	_, err := d.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS _migrations (
			version  INTEGER PRIMARY KEY,
			name     TEXT    NOT NULL,
			applied  TEXT    NOT NULL DEFAULT (datetime('now'))
		)
	`)
	if err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	// Get already-applied versions.
	applied := make(map[int]bool)
	rows, err := d.QueryContext(ctx, "SELECT version FROM _migrations ORDER BY version")
	if err != nil {
		return fmt.Errorf("query applied migrations: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var v int
		if err := rows.Scan(&v); err != nil {
			return fmt.Errorf("scan migration version: %w", err)
		}
		applied[v] = true
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate migrations: %w", err)
	}

	// Apply pending migrations.
	count := 0
	for _, m := range migrations {
		if applied[m.Version] {
			continue
		}

		start := time.Now()

		tx, err := d.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin tx for migration %d (%s): %w", m.Version, m.Name, err)
		}

		if _, err := tx.ExecContext(ctx, m.Up); err != nil {
			tx.Rollback()
			return fmt.Errorf("execute migration %d (%s): %w", m.Version, m.Name, err)
		}

		if _, err := tx.ExecContext(ctx,
			"INSERT INTO _migrations (version, name) VALUES (?, ?)",
			m.Version, m.Name,
		); err != nil {
			tx.Rollback()
			return fmt.Errorf("record migration %d (%s): %w", m.Version, m.Name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %d (%s): %w", m.Version, m.Name, err)
		}

		d.logger.Info("migration applied",
			slog.Int("version", m.Version),
			slog.String("name", m.Name),
			slog.Duration("duration", time.Since(start)),
		)
		count++
	}

	if count > 0 {
		d.logger.Info("migrations complete", slog.Int("applied", count))
	} else {
		d.logger.Info("database up to date", slog.Int("total_migrations", len(migrations)))
	}

	return nil
}
