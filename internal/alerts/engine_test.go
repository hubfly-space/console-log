package alerts

import (
	"context"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/bonheur/go-starter-kit/internal/database"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn}))
}

func TestAlertsEngine(t *testing.T) {
	db, err := database.Open(database.Config{Path: ":memory:"}, testLogger())
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	if err := db.Migrate(ctx, database.DefaultMigrations); err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	// 1. Setup project
	res, err := db.ExecContext(ctx, "INSERT INTO projects (name, api_key) VALUES (?, ?)", "Test Project", "pk_test")
	if err != nil {
		t.Fatalf("failed to insert project: %v", err)
	}
	projectID, _ := res.LastInsertId()

	// 2. Setup alert rule: CPU > 80% or Error count > 2
	res, err = db.ExecContext(ctx, `
		INSERT INTO alert_rules (project_id, name, metric_type, threshold, comparison, time_window_mins, channel, target, active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
	`, projectID, "High Errors", "error_count", 2.0, ">", 5, "email", "test@test.com")
	if err != nil {
		t.Fatalf("failed to insert alert rule: %v", err)
	}
	ruleID, _ := res.LastInsertId()

	engine := NewEngine(db, testLogger())

	// 3. Insert 1 error event (below threshold)
	ts := time.Now().UTC().Format(time.RFC3339)
	_, err = db.ExecContext(ctx, `
		INSERT INTO events (project_id, type, timestamp, level, message, payload, error_group)
		VALUES (?, 'error', ?, 'error', 'something failed', '{}', 'err_grp_1')
	`, projectID, ts)
	if err != nil {
		t.Fatalf("failed to insert event: %v", err)
	}

	// Evaluate: should NOT trigger alert
	engine.Evaluate()

	var count int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM alerts_history WHERE rule_id = ?", ruleID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query alert history count: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 triggers, got %d", count)
	}

	// 4. Insert 2 more errors (now 3 total, above threshold)
	for i := 0; i < 2; i++ {
		_, err = db.ExecContext(ctx, `
			INSERT INTO events (project_id, type, timestamp, level, message, payload, error_group)
			VALUES (?, 'error', ?, 'error', 'something failed', '{}', 'err_grp_1')
		`, projectID, ts)
		if err != nil {
			t.Fatalf("failed to insert event: %v", err)
		}
	}

	// Evaluate: SHOULD trigger alert
	engine.Evaluate()

	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM alerts_history WHERE rule_id = ?", ruleID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query alert history count: %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 alert trigger, got %d", count)
	}

	// Verify incident created
	var incCount int
	err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM incidents WHERE project_id = ?", projectID).Scan(&incCount)
	if err != nil {
		t.Fatalf("failed to query incident count: %v", err)
	}
	if incCount != 1 {
		t.Errorf("expected 1 incident to be auto-created, got %d", incCount)
	}
}
