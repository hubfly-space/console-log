package database

import (
	"context"
	"log/slog"
	"os"
	"testing"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
}

func TestOpen_InMemory(t *testing.T) {
	db, err := Open(Config{Path: ":memory:"}, testLogger())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	// Verify WAL mode is active (in-memory uses "memory" journal mode).
	var jm string
	if err := db.QueryRow("PRAGMA journal_mode").Scan(&jm); err != nil {
		t.Fatalf("PRAGMA journal_mode: %v", err)
	}
	// In-memory DBs use "memory" instead of "wal", which is expected.
	if jm != "memory" && jm != "wal" {
		t.Errorf("unexpected journal_mode: %s", jm)
	}

	// Verify foreign keys are on.
	var fk int
	if err := db.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("PRAGMA foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Errorf("foreign_keys = %d, want 1", fk)
	}
}

func TestOpen_WAL_FileDB(t *testing.T) {
	tmp := t.TempDir()
	dbPath := tmp + "/test.db"

	db, err := Open(Config{Path: dbPath}, testLogger())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	var jm string
	if err := db.QueryRow("PRAGMA journal_mode").Scan(&jm); err != nil {
		t.Fatalf("PRAGMA journal_mode: %v", err)
	}
	if jm != "wal" {
		t.Errorf("journal_mode = %q, want %q", jm, "wal")
	}
}

func TestMigrate(t *testing.T) {
	db, err := Open(Config{Path: ":memory:"}, testLogger())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	// Run default migrations.
	if err := db.Migrate(ctx, DefaultMigrations); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	// Verify tables exist.
	tables := []string{"users", "sessions", "settings", "_migrations"}
	for _, tbl := range tables {
		var name string
		err := db.QueryRowContext(ctx,
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?", tbl,
		).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", tbl, err)
		}
	}

	// Verify idempotency — running again should not error.
	if err := db.Migrate(ctx, DefaultMigrations); err != nil {
		t.Fatalf("Migrate (idempotent): %v", err)
	}

	// Verify migration count.
	var count int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM _migrations").Scan(&count); err != nil {
		t.Fatalf("count migrations: %v", err)
	}
	if count != len(DefaultMigrations) {
		t.Errorf("migration count = %d, want %d", count, len(DefaultMigrations))
	}
}

func TestHealth(t *testing.T) {
	db, err := Open(Config{Path: ":memory:"}, testLogger())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	health := db.Health(context.Background())

	if health["status"] != "up" {
		t.Errorf("status = %v, want up", health["status"])
	}
	if _, ok := health["latency_ms"]; !ok {
		t.Error("latency_ms not present")
	}
}

func TestCRUD_Users(t *testing.T) {
	db, err := Open(Config{Path: ":memory:"}, testLogger())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	if err := db.Migrate(ctx, DefaultMigrations); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	// Insert a user.
	res, err := db.ExecContext(ctx,
		"INSERT INTO users (email, name) VALUES (?, ?)", "test@example.com", "Test User",
	)
	if err != nil {
		t.Fatalf("INSERT: %v", err)
	}
	id, _ := res.LastInsertId()
	if id != 1 {
		t.Errorf("id = %d, want 1", id)
	}

	// Read the user back.
	var email, name string
	err = db.QueryRowContext(ctx, "SELECT email, name FROM users WHERE id = ?", id).Scan(&email, &name)
	if err != nil {
		t.Fatalf("SELECT: %v", err)
	}
	if email != "test@example.com" || name != "Test User" {
		t.Errorf("got email=%q name=%q", email, name)
	}

	// Unique constraint.
	_, err = db.ExecContext(ctx,
		"INSERT INTO users (email, name) VALUES (?, ?)", "test@example.com", "Dupe",
	)
	if err == nil {
		t.Error("expected unique constraint error, got nil")
	}
}
