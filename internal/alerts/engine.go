package alerts

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/bonheur/go-starter-kit/internal/database"
)

type ruleInfo struct {
	id             int
	projectID      int
	name           string
	metricType     string
	threshold      float64
	comparison     string
	timeWindowMins int
	channel        string
	target         string
}

type Engine struct {
	db     *database.DB
	logger *slog.Logger
	ctx    context.Context
	cancel context.CancelFunc
}

func NewEngine(db *database.DB, logger *slog.Logger) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	return &Engine{
		db:     db,
		logger: logger,
		ctx:    ctx,
		cancel: cancel,
	}
}

func (e *Engine) Start() {
	e.logger.Info("Starting Alerts Engine background worker")
	go e.loop()
}

func (e *Engine) Stop() {
	e.logger.Info("Stopping Alerts Engine")
	e.cancel()
}

func (e *Engine) loop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Initial evaluation
	e.Evaluate()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.Evaluate()
		}
	}
}

func (e *Engine) Evaluate() {
	e.logger.Debug("Evaluating active alert rules...")
	ctx := e.ctx

	rows, err := e.db.QueryContext(ctx, `
		SELECT id, project_id, name, metric_type, threshold, comparison, time_window_mins, channel, target
		FROM alert_rules WHERE active = 1
	`)
	if err != nil {
		e.logger.Error("failed to query alert rules", slog.String("error", err.Error()))
		return
	}
	defer rows.Close()

	var rules []ruleInfo
	for rows.Next() {
		var r ruleInfo
		if err := rows.Scan(&r.id, &r.projectID, &r.name, &r.metricType, &r.threshold, &r.comparison, &r.timeWindowMins, &r.channel, &r.target); err == nil {
			rules = append(rules, r)
		}
	}

	for _, r := range rules {
		e.evaluateRule(ctx, r)
	}
}

func (e *Engine) evaluateRule(ctx context.Context, r ruleInfo) {
	startTime := time.Now().UTC().Add(-time.Duration(r.timeWindowMins) * time.Minute).Format(time.RFC3339)
	var value float64
	var err error

	switch r.metricType {
	case "error_count":
		err = e.db.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM events 
			WHERE project_id = ? AND type = 'error' AND timestamp >= ?
		`, r.projectID, startTime).Scan(&value)

	case "log_volume":
		err = e.db.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM events 
			WHERE project_id = ? AND type IN ('log', 'error') AND timestamp >= ?
		`, r.projectID, startTime).Scan(&value)

	case "cpu_usage", "memory_usage":
		value, err = e.evaluateMetric(ctx, r.projectID, r.metricType, startTime)

	default:
		e.logger.Warn("unknown metric type for alert rule", slog.String("type", r.metricType), slog.Int("rule_id", r.id))
		return
	}

	if err != nil {
		e.logger.Error("failed to evaluate alert rule query", slog.Int("rule_id", r.id), slog.String("error", err.Error()))
		return
	}

	triggered := false
	switch r.comparison {
	case ">":
		triggered = value > r.threshold
	case "<":
		triggered = value < r.threshold
	case ">=":
		triggered = value >= r.threshold
	case "<=":
		triggered = value <= r.threshold
	case "=":
		triggered = value == r.threshold
	}

	if triggered {
		// Deduplicate alert triggering: check if this rule was triggered in the last 2 minutes
		var exists bool
		dupTime := time.Now().UTC().Add(-2 * time.Minute).Format(time.RFC3339)
		err = e.db.QueryRowContext(ctx, `
			SELECT EXISTS(SELECT 1 FROM alerts_history WHERE rule_id = ? AND triggered_at >= ?)
		`, r.id, dupTime).Scan(&exists)
		if err != nil {
			e.logger.Error("failed to query alert history de-duplication", slog.String("error", err.Error()))
			return
		}

		if exists {
			// Already triggered recently, skip to prevent spamming
			return
		}

		e.logger.Warn("ALERT TRIGGERED!", slog.String("rule", r.name), slog.Float64("value", value), slog.Float64("threshold", r.threshold))

		// Write to history
		_, err = e.db.ExecContext(ctx, `
			INSERT INTO alerts_history (rule_id, project_id, triggered_value)
			VALUES (?, ?, ?)
		`, r.id, r.projectID, value)
		if err != nil {
			e.logger.Error("failed to save alert trigger history", slog.String("error", err.Error()))
		}

		// Auto-create an Incident for visibility
		severity := "warning"
		if r.metricType == "error_count" && value > 10 {
			severity = "critical"
		}
		title := fmt.Sprintf("Alert Triggered: %s", r.name)
		desc := fmt.Sprintf("Alert rule '%s' triggered. Metric '%s' was %s %g (Threshold: %s %g) over the last %d mins.",
			r.name, r.metricType, r.comparison, value, r.comparison, r.threshold, r.timeWindowMins)

		res, err := e.db.ExecContext(ctx, `
			INSERT INTO incidents (project_id, title, status, severity, description)
			VALUES (?, ?, 'open', ?, ?)
		`, r.projectID, title, severity, desc)
		if err != nil {
			e.logger.Error("failed to auto-create incident for alert", slog.String("error", err.Error()))
		} else {
			incID, _ := res.LastInsertId()
			_, _ = e.db.ExecContext(ctx, `
				INSERT INTO incident_updates (incident_id, message, status) 
				VALUES (?, 'Incident created automatically by Alerts Engine.', 'open')
			`, incID)
		}
	}
}

func (e *Engine) evaluateMetric(ctx context.Context, projectID int, metricName string, startTime string) (float64, error) {
	rows, err := e.db.QueryContext(ctx, `
		SELECT payload FROM events
		WHERE project_id = ? AND type = 'metric' AND message = ? AND timestamp >= ?
	`, projectID, metricName, startTime)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var sum float64
	var count int

	for rows.Next() {
		var payloadStr string
		if err := rows.Scan(&payloadStr); err == nil {
			var p map[string]any
			if err := json.Unmarshal([]byte(payloadStr), &p); err == nil {
				if val, exists := p["value"]; exists {
					switch v := val.(type) {
					case float64:
						sum += v
						count++
					case int:
						sum += float64(v)
						count++
					}
				}
			}
		}
	}

	if count == 0 {
		return 0, nil
	}
	return sum / float64(count), nil
}
