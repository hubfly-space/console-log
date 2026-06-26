package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/bonheur/go-starter-kit/internal/middleware"
)

// --- Auth Structures ---

type SignUpInput struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

type SignUpOutput struct {
	Success bool   `json:"success"`
	Token   string `json:"token"`
	User    User   `json:"user"`
}

type LoginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginOutput struct {
	Success bool   `json:"success"`
	Token   string `json:"token"`
	User    User   `json:"user"`
}

type LogoutInput struct{}

type LogoutOutput struct {
	Success bool `json:"success"`
}

type EmptyInput struct{}

type CurrentUserOutput struct {
	Success bool `json:"success"`
	User    User `json:"user"`
}

type User struct {
	ID    int    `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

// --- Project/Stream Structures ---

type CreateProjectInput struct {
	Name string `json:"name"`
}

type Project struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	APIKey    string `json:"apiKey"`
	CreatedAt string `json:"createdAt"`
}

type CreateProjectOutput struct {
	Success bool    `json:"success"`
	Project Project `json:"project"`
}

type ListProjectsOutput struct {
	Projects []Project `json:"projects"`
}

type CreateStreamInput struct {
	ProjectID int    `json:"projectId"`
	Name      string `json:"name"`
}

type Stream struct {
	ID        int    `json:"id"`
	ProjectID int    `json:"projectId"`
	Name      string `json:"name"`
	StreamKey string `json:"streamKey"`
	CreatedAt string `json:"createdAt"`
}

type CreateStreamOutput struct {
	Success bool   `json:"success"`
	Stream  Stream `json:"stream"`
}

type ListStreamsInput struct {
	ProjectID int `json:"projectId"`
}

type ListStreamsOutput struct {
	Streams []Stream `json:"streams"`
}

// --- Observability Structures ---

type QueryLogsInput struct {
	ProjectID int      `json:"projectId"`
	StreamID  *int     `json:"streamId"`
	Query     string   `json:"query"`
	Levels    []string `json:"levels"`
	StartTime string   `json:"startTime"`
	EndTime   string   `json:"endTime"`
	Limit     int      `json:"limit"`
	Offset    int      `json:"offset"`
}

type LogEvent struct {
	ID        int            `json:"id"`
	ProjectID int            `json:"projectId"`
	StreamID  *int           `json:"streamId"`
	Type      string         `json:"type"`
	Timestamp string         `json:"timestamp"`
	Level     string         `json:"level"`
	Message   string         `json:"message"`
	Payload   map[string]any `json:"payload"`
}

type QueryLogsOutput struct {
	Logs []LogEvent `json:"logs"`
}

type GetLogHistogramInput struct {
	ProjectID int      `json:"projectId"`
	StreamID  *int     `json:"streamId"`
	Query     string   `json:"query"`
	Levels    []string `json:"levels"`
	StartTime string   `json:"startTime"`
	EndTime   string   `json:"endTime"`
}

type HistogramBucket struct {
	Time  string `json:"time"`
	Count int    `json:"count"`
}

type GetLogHistogramOutput struct {
	Buckets []HistogramBucket `json:"buckets"`
}

type QueryErrorsInput struct {
	ProjectID int    `json:"projectId"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
}

type ErrorGroup struct {
	Message    string `json:"message"`
	ErrorGroup string `json:"errorGroup"`
	Count      int    `json:"count"`
	FirstSeen  string `json:"firstSeen"`
	LastSeen   string `json:"lastSeen"`
	Level      string `json:"level"`
}

type QueryErrorsOutput struct {
	Errors []ErrorGroup `json:"errors"`
}

type GetErrorDetailsInput struct {
	ErrorGroup string `json:"errorGroup"`
}

type GetErrorDetailsOutput struct {
	Errors []LogEvent `json:"errors"`
}

type QueryMetricsInput struct {
	ProjectID  int    `json:"projectId"`
	MetricName string `json:"metricName"`
	StartTime  string `json:"startTime"`
	EndTime    string `json:"endTime"`
}

type MetricDataPoint struct {
	Timestamp string  `json:"timestamp"`
	Value     float64 `json:"value"`
}

type QueryMetricsOutput struct {
	Points []MetricDataPoint `json:"points"`
}

// --- Hello / Demo Structures ---

type HelloInput struct {
	Name string `json:"name"`
}

type HelloOutput struct {
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

// --- Implementation ---

// SignUp registers a new user with hashed password.
func (a *APIHandler) SignUp(ctx context.Context, in SignUpInput) (SignUpOutput, error) {
	if in.Email == "" || in.Password == "" {
		return SignUpOutput{Success: false}, fmt.Errorf("email and password are required")
	}

	// Check if user already exists
	var exists bool
	err := a.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = ?)", in.Email).Scan(&exists)
	if err != nil {
		return SignUpOutput{Success: false}, fmt.Errorf("database error: %w", err)
	}
	if exists {
		return SignUpOutput{Success: false}, fmt.Errorf("user with this email already exists")
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return SignUpOutput{Success: false}, fmt.Errorf("failed to hash password: %w", err)
	}

	// Insert user
	res, err := a.db.ExecContext(ctx, "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)", in.Email, in.Name, string(passwordHash))
	if err != nil {
		return SignUpOutput{Success: false}, fmt.Errorf("failed to create user: %w", err)
	}

	userID, err := res.LastInsertId()
	if err != nil {
		return SignUpOutput{Success: false}, fmt.Errorf("failed to get user id: %w", err)
	}

	user := User{
		ID:    int(userID),
		Email: in.Email,
		Name:  in.Name,
	}

	// Create session
	token := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour).Format(time.RFC3339)
	_, err = a.db.ExecContext(ctx, "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", token, user.ID, expiresAt)
	if err != nil {
		return SignUpOutput{Success: false}, fmt.Errorf("failed to create session: %w", err)
	}

	return SignUpOutput{
		Success: true,
		Token:   token,
		User:    user,
	}, nil
}

// Login verifies password and returns session token.
func (a *APIHandler) Login(ctx context.Context, in LoginInput) (LoginOutput, error) {
	var user User
	var passwordHash string
	err := a.db.QueryRowContext(ctx, "SELECT id, email, name, password_hash FROM users WHERE email = ?", in.Username).Scan(&user.ID, &user.Email, &user.Name, &passwordHash)
	if err != nil {
		if err == sql.ErrNoRows {
			return LoginOutput{Success: false}, fmt.Errorf("invalid credentials")
		}
		return LoginOutput{Success: false}, fmt.Errorf("database error: %w", err)
	}

	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(in.Password))
	if err != nil {
		return LoginOutput{Success: false}, fmt.Errorf("invalid credentials")
	}

	// Create session
	token := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour).Format(time.RFC3339)
	_, err = a.db.ExecContext(ctx, "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", token, user.ID, expiresAt)
	if err != nil {
		return LoginOutput{Success: false}, fmt.Errorf("failed to create session: %w", err)
	}

	return LoginOutput{
		Success: true,
		Token:   token,
		User:    user,
	}, nil
}

// Logout invalidates a user session.
func (a *APIHandler) Logout(ctx context.Context, in LogoutInput) (LogoutOutput, error) {
	token, ok := middleware.GetSessionFromContext(ctx)
	if !ok {
		return LogoutOutput{Success: false}, fmt.Errorf("not logged in")
	}
	_, err := a.db.ExecContext(ctx, "DELETE FROM sessions WHERE id = ?", token)
	if err != nil {
		return LogoutOutput{Success: false}, fmt.Errorf("failed to delete session: %w", err)
	}
	return LogoutOutput{Success: true}, nil
}

// GetCurrentUser returns the user associated with the session.
func (a *APIHandler) GetCurrentUser(ctx context.Context, in EmptyInput) (CurrentUserOutput, error) {
	userID, email, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return CurrentUserOutput{Success: false}, fmt.Errorf("unauthorized")
	}
	var name string
	err := a.db.QueryRowContext(ctx, "SELECT name FROM users WHERE id = ?", userID).Scan(&name)
	if err != nil {
		name = ""
	}
	return CurrentUserOutput{
		Success: true,
		User: User{
			ID:    userID,
			Email: email,
			Name:  name,
		},
	}, nil
}

// CreateProject creates a new project with a unique API key.
func (a *APIHandler) CreateProject(ctx context.Context, in CreateProjectInput) (CreateProjectOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return CreateProjectOutput{Success: false}, fmt.Errorf("unauthorized")
	}
	if in.Name == "" {
		return CreateProjectOutput{Success: false}, fmt.Errorf("project name is required")
	}
	apiKey := "pk_" + uuid.New().String()
	res, err := a.db.ExecContext(ctx, "INSERT INTO projects (name, api_key) VALUES (?, ?)", in.Name, apiKey)
	if err != nil {
		return CreateProjectOutput{Success: false}, fmt.Errorf("failed to create project: %w", err)
	}
	projID, err := res.LastInsertId()
	if err != nil {
		return CreateProjectOutput{Success: false}, fmt.Errorf("failed to get project id: %w", err)
	}
	var createdAt string
	err = a.db.QueryRowContext(ctx, "SELECT created_at FROM projects WHERE id = ?", projID).Scan(&createdAt)
	if err != nil {
		createdAt = time.Now().Format(time.RFC3339)
	}
	a.recordAuditLog(ctx, "Create Project", fmt.Sprintf("Created project '%s' (ID %d)", in.Name, projID))
	return CreateProjectOutput{
		Success: true,
		Project: Project{
			ID:        int(projID),
			Name:      in.Name,
			APIKey:    apiKey,
			CreatedAt: createdAt,
		},
	}, nil
}

// ListProjects lists all projects in the system.
func (a *APIHandler) ListProjects(ctx context.Context, in EmptyInput) (ListProjectsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return ListProjectsOutput{}, fmt.Errorf("unauthorized")
	}
	rows, err := a.db.QueryContext(ctx, "SELECT id, name, api_key, created_at FROM projects ORDER BY created_at DESC")
	if err != nil {
		return ListProjectsOutput{}, fmt.Errorf("failed to query projects: %w", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.APIKey, &p.CreatedAt); err != nil {
			return ListProjectsOutput{}, fmt.Errorf("failed to scan project: %w", err)
		}
		projects = append(projects, p)
	}
	if projects == nil {
		projects = []Project{}
	}
	return ListProjectsOutput{Projects: projects}, nil
}

// CreateStream creates an ingestion channel for a project.
func (a *APIHandler) CreateStream(ctx context.Context, in CreateStreamInput) (CreateStreamOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return CreateStreamOutput{Success: false}, fmt.Errorf("unauthorized")
	}
	if in.Name == "" {
		return CreateStreamOutput{Success: false}, fmt.Errorf("stream name is required")
	}
	streamKey := "sk_" + uuid.New().String()
	res, err := a.db.ExecContext(ctx, "INSERT INTO streams (project_id, name, stream_key) VALUES (?, ?, ?)", in.ProjectID, in.Name, streamKey)
	if err != nil {
		return CreateStreamOutput{Success: false}, fmt.Errorf("failed to create stream: %w", err)
	}
	streamID, err := res.LastInsertId()
	if err != nil {
		return CreateStreamOutput{Success: false}, fmt.Errorf("failed to get stream id: %w", err)
	}
	var createdAt string
	err = a.db.QueryRowContext(ctx, "SELECT created_at FROM streams WHERE id = ?", streamID).Scan(&createdAt)
	if err != nil {
		createdAt = time.Now().Format(time.RFC3339)
	}
	a.recordAuditLog(ctx, "Create Stream", fmt.Sprintf("Created stream '%s' (ID %d) for project ID %d", in.Name, streamID, in.ProjectID))
	return CreateStreamOutput{
		Success: true,
		Stream: Stream{
			ID:        int(streamID),
			ProjectID: in.ProjectID,
			Name:      in.Name,
			StreamKey: streamKey,
			CreatedAt: createdAt,
		},
	}, nil
}

// ListStreams lists streams for a given project.
func (a *APIHandler) ListStreams(ctx context.Context, in ListStreamsInput) (ListStreamsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return ListStreamsOutput{}, fmt.Errorf("unauthorized")
	}
	rows, err := a.db.QueryContext(ctx, "SELECT id, project_id, name, stream_key, created_at FROM streams WHERE project_id = ? ORDER BY created_at DESC", in.ProjectID)
	if err != nil {
		return ListStreamsOutput{}, fmt.Errorf("failed to query streams: %w", err)
	}
	defer rows.Close()

	var streams []Stream
	for rows.Next() {
		var s Stream
		if err := rows.Scan(&s.ID, &s.ProjectID, &s.Name, &s.StreamKey, &s.CreatedAt); err != nil {
			return ListStreamsOutput{}, fmt.Errorf("failed to scan stream: %w", err)
		}
		streams = append(streams, s)
	}
	if streams == nil {
		streams = []Stream{}
	}
	return ListStreamsOutput{Streams: streams}, nil
}

// --- Query Event Implementations ---

// QueryLogs filters and searches log/error events.
func (a *APIHandler) QueryLogs(ctx context.Context, in QueryLogsInput) (QueryLogsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return QueryLogsOutput{}, fmt.Errorf("unauthorized")
	}

	queryStr := "SELECT id, project_id, stream_id, type, timestamp, level, message, payload FROM events WHERE project_id = ? AND type IN ('log', 'error')"
	args := []any{in.ProjectID}

	if in.StreamID != nil {
		queryStr += " AND stream_id = ?"
		args = append(args, *in.StreamID)
	}

	if len(in.Levels) > 0 {
		queryStr += " AND level IN ("
		for i, lvl := range in.Levels {
			if i > 0 {
				queryStr += ","
			}
			queryStr += "?"
			args = append(args, lvl)
		}
		queryStr += ")"
	}

	if in.StartTime != "" {
		queryStr += " AND timestamp >= ?"
		args = append(args, in.StartTime)
	}
	if in.EndTime != "" {
		queryStr += " AND timestamp <= ?"
		args = append(args, in.EndTime)
	}

	if in.Query != "" {
		queryStr += " AND (message LIKE ? OR payload LIKE ?)"
		args = append(args, "%"+in.Query+"%", "%"+in.Query+"%")
	}

	queryStr += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
	limit := in.Limit
	if limit <= 0 {
		limit = 100
	}
	args = append(args, limit, in.Offset)

	rows, err := a.db.QueryContext(ctx, queryStr, args...)
	if err != nil {
		return QueryLogsOutput{}, fmt.Errorf("failed to query logs: %w", err)
	}
	defer rows.Close()

	var logs []LogEvent
	for rows.Next() {
		var ev LogEvent
		var payloadStr string
		var streamIDVal sql.NullInt64

		err := rows.Scan(
			&ev.ID,
			&ev.ProjectID,
			&streamIDVal,
			&ev.Type,
			&ev.Timestamp,
			&ev.Level,
			&ev.Message,
			&payloadStr,
		)
		if err != nil {
			return QueryLogsOutput{}, fmt.Errorf("failed to scan log event: %w", err)
		}

		if streamIDVal.Valid {
			idVal := int(streamIDVal.Int64)
			ev.StreamID = &idVal
		}

		ev.Payload = make(map[string]any)
		_ = json.Unmarshal([]byte(payloadStr), &ev.Payload)

		logs = append(logs, ev)
	}

	if logs == nil {
		logs = []LogEvent{}
	}

	return QueryLogsOutput{Logs: logs}, nil
}

// GetLogHistogram aggregates log frequencies into 20 time-buckets.
func (a *APIHandler) GetLogHistogram(ctx context.Context, in GetLogHistogramInput) (GetLogHistogramOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return GetLogHistogramOutput{}, fmt.Errorf("unauthorized")
	}

	queryStr := "SELECT timestamp FROM events WHERE project_id = ? AND type IN ('log', 'error')"
	args := []any{in.ProjectID}

	if in.StreamID != nil {
		queryStr += " AND stream_id = ?"
		args = append(args, *in.StreamID)
	}

	if len(in.Levels) > 0 {
		queryStr += " AND level IN ("
		for i, lvl := range in.Levels {
			if i > 0 {
				queryStr += ","
			}
			queryStr += "?"
			args = append(args, lvl)
		}
		queryStr += ")"
	}

	if in.StartTime != "" {
		queryStr += " AND timestamp >= ?"
		args = append(args, in.StartTime)
	}
	if in.EndTime != "" {
		queryStr += " AND timestamp <= ?"
		args = append(args, in.EndTime)
	}

	if in.Query != "" {
		queryStr += " AND (message LIKE ? OR payload LIKE ?)"
		args = append(args, "%"+in.Query+"%", "%"+in.Query+"%")
	}

	rows, err := a.db.QueryContext(ctx, queryStr, args...)
	if err != nil {
		return GetLogHistogramOutput{}, fmt.Errorf("failed to query log timestamps: %w", err)
	}
	defer rows.Close()

	var times []time.Time
	for rows.Next() {
		var tsStr string
		if err := rows.Scan(&tsStr); err == nil {
			if t, err := time.Parse(time.RFC3339, tsStr); err == nil {
				times = append(times, t)
			} else if t, err := time.Parse("2006-01-02 15:04:05", tsStr); err == nil {
				times = append(times, t)
			}
		}
	}

	bucketCount := 20
	buckets := make([]HistogramBucket, bucketCount)

	var start, end time.Time
	if in.StartTime != "" {
		start, _ = time.Parse(time.RFC3339, in.StartTime)
	}
	if start.IsZero() && len(times) > 0 {
		start = times[len(times)-1]
	}
	if in.EndTime != "" {
		end, _ = time.Parse(time.RFC3339, in.EndTime)
	}
	if end.IsZero() {
		end = time.Now()
	}
	if start.IsZero() {
		start = end.Add(-1 * time.Hour)
	}

	// Recalculate start/end bounds from raw time data points
	for _, t := range times {
		if start.IsZero() || t.Before(start) {
			start = t
		}
		if end.IsZero() || t.After(end) {
			end = t
		}
	}

	duration := end.Sub(start)
	bucketDuration := duration / time.Duration(bucketCount)
	if bucketDuration <= 0 {
		bucketDuration = time.Second
	}

	for i := 0; i < bucketCount; i++ {
		bStart := start.Add(bucketDuration * time.Duration(i))
		buckets[i] = HistogramBucket{
			Time:  bStart.Format(time.RFC3339),
			Count: 0,
		}
	}

	for _, t := range times {
		if t.Before(start) || t.After(end) {
			continue
		}
		index := int(t.Sub(start) / bucketDuration)
		if index >= bucketCount {
			index = bucketCount - 1
		}
		if index >= 0 {
			buckets[index].Count++
		}
	}

	return GetLogHistogramOutput{Buckets: buckets}, nil
}

// QueryErrors groups exceptions by message for Exception Intelligence.
func (a *APIHandler) QueryErrors(ctx context.Context, in QueryErrorsInput) (QueryErrorsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return QueryErrorsOutput{}, fmt.Errorf("unauthorized")
	}

	queryStr := `
		SELECT message, error_group, COUNT(*), MIN(timestamp), MAX(timestamp), level
		FROM events
		WHERE project_id = ? AND type = 'error'`
	args := []any{in.ProjectID}

	if in.StartTime != "" {
		queryStr += " AND timestamp >= ?"
		args = append(args, in.StartTime)
	}
	if in.EndTime != "" {
		queryStr += " AND timestamp <= ?"
		args = append(args, in.EndTime)
	}

	queryStr += " GROUP BY error_group ORDER BY MAX(timestamp) DESC"

	rows, err := a.db.QueryContext(ctx, queryStr, args...)
	if err != nil {
		return QueryErrorsOutput{}, fmt.Errorf("failed to query errors: %w", err)
	}
	defer rows.Close()

	var errors []ErrorGroup
	for rows.Next() {
		var eg ErrorGroup
		err := rows.Scan(
			&eg.Message,
			&eg.ErrorGroup,
			&eg.Count,
			&eg.FirstSeen,
			&eg.LastSeen,
			&eg.Level,
		)
		if err != nil {
			return QueryErrorsOutput{}, fmt.Errorf("failed to scan error group: %w", err)
		}
		errors = append(errors, eg)
	}
	if errors == nil {
		errors = []ErrorGroup{}
	}
	return QueryErrorsOutput{Errors: errors}, nil
}

// GetErrorDetails lists occurrences and contexts of a specific error group.
func (a *APIHandler) GetErrorDetails(ctx context.Context, in GetErrorDetailsInput) (GetErrorDetailsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return GetErrorDetailsOutput{}, fmt.Errorf("unauthorized")
	}

	rows, err := a.db.QueryContext(ctx, `
		SELECT id, project_id, stream_id, type, timestamp, level, message, payload
		FROM events
		WHERE type = 'error' AND error_group = ?
		ORDER BY timestamp DESC LIMIT 50`, in.ErrorGroup)
	if err != nil {
		return GetErrorDetailsOutput{}, fmt.Errorf("failed to query error details: %w", err)
	}
	defer rows.Close()

	var logs []LogEvent
	for rows.Next() {
		var ev LogEvent
		var payloadStr string
		var streamIDVal sql.NullInt64

		err := rows.Scan(
			&ev.ID,
			&ev.ProjectID,
			&streamIDVal,
			&ev.Type,
			&ev.Timestamp,
			&ev.Level,
			&ev.Message,
			&payloadStr,
		)
		if err != nil {
			return GetErrorDetailsOutput{}, fmt.Errorf("failed to scan error detail: %w", err)
		}

		if streamIDVal.Valid {
			idVal := int(streamIDVal.Int64)
			ev.StreamID = &idVal
		}

		ev.Payload = make(map[string]any)
		_ = json.Unmarshal([]byte(payloadStr), &ev.Payload)
		logs = append(logs, ev)
	}
	if logs == nil {
		logs = []LogEvent{}
	}
	return GetErrorDetailsOutput{Errors: logs}, nil
}

// QueryMetrics extracts numeric values from structured payload JSONs over time.
func (a *APIHandler) QueryMetrics(ctx context.Context, in QueryMetricsInput) (QueryMetricsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return QueryMetricsOutput{}, fmt.Errorf("unauthorized")
	}

	queryStr := `
		SELECT timestamp, payload
		FROM events
		WHERE project_id = ? AND type = 'metric' AND message = ?`
	args := []any{in.ProjectID, in.MetricName}

	if in.StartTime != "" {
		queryStr += " AND timestamp >= ?"
		args = append(args, in.StartTime)
	}
	if in.EndTime != "" {
		queryStr += " AND timestamp <= ?"
		args = append(args, in.EndTime)
	}

	queryStr += " ORDER BY timestamp ASC"

	rows, err := a.db.QueryContext(ctx, queryStr, args...)
	if err != nil {
		return QueryMetricsOutput{}, fmt.Errorf("failed to query metrics: %w", err)
	}
	defer rows.Close()

	var points []MetricDataPoint
	for rows.Next() {
		var ts string
		var payloadStr string
		if err := rows.Scan(&ts, &payloadStr); err == nil {
			var p map[string]any
			if err := json.Unmarshal([]byte(payloadStr), &p); err == nil {
				if val, exists := p["value"]; exists {
					var floatVal float64
					switch v := val.(type) {
					case float64:
						floatVal = v
					case int:
						floatVal = float64(v)
					}
					points = append(points, MetricDataPoint{
						Timestamp: ts,
						Value:     floatVal,
					})
				}
			}
		}
	}
	if points == nil {
		points = []MetricDataPoint{}
	}
	return QueryMetricsOutput{Points: points}, nil
}

// GenerateDemoData seeds logs, metrics, and errors in SQLite for demonstration.
func (a *APIHandler) GenerateDemoData(ctx context.Context, in EmptyInput) (EmptyInput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return EmptyInput{}, fmt.Errorf("unauthorized")
	}

	var projectID int
	err := a.db.QueryRowContext(ctx, "SELECT id FROM projects LIMIT 1").Scan(&projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			apiKey := "pk_" + uuid.New().String()
			res, err := a.db.ExecContext(ctx, "INSERT INTO projects (name, api_key) VALUES ('Demo Project', ?)", apiKey)
			if err != nil {
				return EmptyInput{}, fmt.Errorf("failed to create demo project: %w", err)
			}
			projID, _ := res.LastInsertId()
			projectID = int(projID)
		} else {
			return EmptyInput{}, fmt.Errorf("failed to check projects: %w", err)
		}
	}

	var streamID int
	err = a.db.QueryRowContext(ctx, "SELECT id FROM streams WHERE project_id = ? LIMIT 1", projectID).Scan(&streamID)
	if err != nil {
		if err == sql.ErrNoRows {
			streamKey := "sk_" + uuid.New().String()
			res, err := a.db.ExecContext(ctx, "INSERT INTO streams (project_id, name, stream_key) VALUES (?, 'prod-api', ?)", projectID, streamKey)
			if err != nil {
				return EmptyInput{}, fmt.Errorf("failed to create demo stream: %w", err)
			}
			stID, _ := res.LastInsertId()
			streamID = int(stID)
		} else {
			return EmptyInput{}, fmt.Errorf("failed to check streams: %w", err)
		}
	}

	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return EmptyInput{}, err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO events (project_id, stream_id, type, timestamp, level, message, payload, error_group)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return EmptyInput{}, err
	}
	defer stmt.Close()

	now := time.Now().UTC()

	// 1. Generate logs
	logMessages := []string{
		"User connection established",
		"Cache miss - revalidating key",
		"API request completed successfully",
		"Database transaction committed",
		"Token validation success",
		"Job scheduler worker checked in",
	}
	logLevels := []string{"info", "info", "info", "debug", "info", "debug"}

	for i := 0; i < 60; i++ {
		idx := i % len(logMessages)
		lvl := logLevels[idx]
		msg := logMessages[idx]
		ts := now.Add(-time.Duration(i*2) * time.Minute).Format(time.RFC3339)
		payload := map[string]any{
			"duration_ms": 10 + (i*3)%200,
			"path":        "/api/v1/resource",
			"status":      200,
		}
		pBytes, _ := json.Marshal(payload)

		_, _ = stmt.ExecContext(ctx, projectID, streamID, "log", ts, lvl, msg, string(pBytes), "")
	}

	// 2. Generate metrics (CPU & Memory)
	for i := 0; i < 40; i++ {
		ts := now.Add(-time.Duration(i*3) * time.Minute).Format(time.RFC3339)

		// CPU metric
		cpuVal := 20.0 + float64((i*7)%60)
		cpuPayload, _ := json.Marshal(map[string]any{"value": cpuVal, "unit": "%"})
		_, _ = stmt.ExecContext(ctx, projectID, streamID, "metric", ts, "info", "cpu_usage", string(cpuPayload), "")

		// RAM metric
		ramVal := 512.0 + float64((i*23)%200)
		ramPayload, _ := json.Marshal(map[string]any{"value": ramVal, "unit": "MB"})
		_, _ = stmt.ExecContext(ctx, projectID, streamID, "metric", ts, "info", "memory_usage", string(ramPayload), "")
	}

	// 3. Generate errors
	errMessages := []string{
		"database connection pool exhausted",
		"failed to parse JWT signature validation",
		"payment gateway timeout from Stripe API",
	}

	for i := 0; i < 15; i++ {
		idx := i % len(errMessages)
		msg := errMessages[idx]
		ts := now.Add(-time.Duration(i*7) * time.Minute).Format(time.RFC3339)
		payload := map[string]any{
			"stack": fmt.Sprintf("Error: %s\n    at authenticate (auth.go:42)\n    at serve (server.go:120)", msg),
			"ip":    "127.0.0.1",
		}
		pBytes, _ := json.Marshal(payload)
		_, _ = stmt.ExecContext(ctx, projectID, streamID, "error", ts, "error", msg, string(pBytes), msg)
	}

	_ = tx.Commit()
	return EmptyInput{}, nil
}

// Hello returns a simple greeting.
// Hello returns a simple greeting.
func (a *APIHandler) Hello(ctx context.Context, in HelloInput) (HelloOutput, error) {
	return HelloOutput{
		Message:   fmt.Sprintf("Hello, %s!", in.Name),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (a *APIHandler) recordAuditLog(ctx context.Context, action string, details string) {
	userID, _, ok := middleware.GetUserFromContext(ctx)
	if ok {
		_, _ = a.db.ExecContext(ctx, "INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)", userID, action, details)
	}
}

// --- Observability Structures and RPC Handlers ---

// --- Alert Structures ---

type CreateAlertRuleInput struct {
	ProjectID      int     `json:"projectId"`
	Name           string  `json:"name"`
	MetricType     string  `json:"metricType"` // "error_count", "log_volume", "cpu_usage", "memory_usage"
	Threshold      float64 `json:"threshold"`
	Comparison     string  `json:"comparison"` // ">", "<", ">=", "<=", "="
	TimeWindowMins int     `json:"timeWindowMins"`
	Channel        string  `json:"channel"`
	Target         string  `json:"target"`
}

type CreateAlertRuleOutput struct {
	Success bool `json:"success"`
	ID      int  `json:"id"`
}

type ListAlertRulesInput struct {
	ProjectID int `json:"projectId"`
}

type AlertRule struct {
	ID             int     `json:"id"`
	ProjectID      int     `json:"projectId"`
	Name           string  `json:"name"`
	MetricType     string  `json:"metricType"`
	Threshold      float64 `json:"threshold"`
	Comparison     string  `json:"comparison"`
	TimeWindowMins int     `json:"timeWindowMins"`
	Channel        string  `json:"channel"`
	Target         string  `json:"target"`
	Active         int     `json:"active"`
	CreatedAt      string  `json:"createdAt"`
}

type ListAlertRulesOutput struct {
	Rules []AlertRule `json:"rules"`
}

type ToggleAlertRuleInput struct {
	ID     int `json:"id"`
	Active int `json:"active"`
}

type ToggleAlertRuleOutput struct {
	Success bool `json:"success"`
}

type DeleteAlertRuleInput struct {
	ID int `json:"id"`
}

type DeleteAlertRuleOutput struct {
	Success bool `json:"success"`
}

type QueryAlertsHistoryInput struct {
	ProjectID int `json:"projectId"`
}

type AlertHistoryEntry struct {
	ID             int     `json:"id"`
	RuleID         int     `json:"ruleId"`
	RuleName       string  `json:"ruleName"`
	MetricType     string  `json:"metricType"`
	TriggeredValue float64 `json:"triggeredValue"`
	Threshold      float64 `json:"threshold"`
	Comparison     string  `json:"comparison"`
	TriggeredAt    string  `json:"triggeredAt"`
}

type QueryAlertsHistoryOutput struct {
	History []AlertHistoryEntry `json:"history"`
}

// --- Dashboard Structures ---

type SaveDashboardInput struct {
	ProjectID int    `json:"projectId"`
	Name      string `json:"name"`
	Layout    string `json:"layout"` // JSON string representation of layout widgets
}

type SaveDashboardOutput struct {
	Success bool `json:"success"`
	ID      int  `json:"id"`
}

type GetDashboardsInput struct {
	ProjectID int `json:"projectId"`
}

type Dashboard struct {
	ID        int    `json:"id"`
	ProjectID int    `json:"projectId"`
	Name      string `json:"name"`
	Layout    string `json:"layout"`
	CreatedAt string `json:"createdAt"`
}

type GetDashboardsOutput struct {
	Dashboards []Dashboard `json:"dashboards"`
}

// --- Incident Structures ---

type CreateIncidentInput struct {
	ProjectID   int    `json:"projectId"`
	Title       string `json:"title"`
	Severity    string `json:"severity"` // "info", "warning", "critical"
	Description string `json:"description"`
}

type CreateIncidentOutput struct {
	Success bool `json:"success"`
	ID      int  `json:"id"`
}

type UpdateIncidentStatusInput struct {
	ID      int    `json:"id"`
	Message string `json:"message"`
	Status  string `json:"status"` // "investigating", "identified", "monitoring", "resolved"
}

type UpdateIncidentStatusOutput struct {
	Success bool `json:"success"`
}

type ListIncidentsInput struct {
	ProjectID int `json:"projectId"`
}

type IncidentUpdate struct {
	ID         int    `json:"id"`
	IncidentID int    `json:"incidentId"`
	Message    string `json:"message"`
	Status     string `json:"status"`
	CreatedAt  string `json:"createdAt"`
}

type Incident struct {
	ID          int              `json:"id"`
	ProjectID   int              `json:"projectId"`
	Title       string           `json:"title"`
	Status      string           `json:"status"`
	Severity    string           `json:"severity"`
	Description string           `json:"description"`
	CreatedAt   string           `json:"createdAt"`
	ResolvedAt  *string          `json:"resolvedAt"`
	Updates     []IncidentUpdate `json:"updates"`
}

type ListIncidentsOutput struct {
	Incidents []Incident `json:"incidents"`
}

// --- Audit Trail Structures ---

type QueryAuditLogsInput struct {
	UserID int `json:"userId"`
}

type AuditLog struct {
	ID        int    `json:"id"`
	UserID    int    `json:"userId"`
	UserName  string `json:"userName"`
	Action    string `json:"action"`
	Details   string `json:"details"`
	CreatedAt string `json:"createdAt"`
}

type QueryAuditLogsOutput struct {
	Logs []AuditLog `json:"logs"`
}

// --- Alert Rules RPC Handlers ---

func (a *APIHandler) CreateAlertRule(ctx context.Context, in CreateAlertRuleInput) (CreateAlertRuleOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return CreateAlertRuleOutput{}, fmt.Errorf("unauthorized")
	}
	res, err := a.db.ExecContext(ctx, `
		INSERT INTO alert_rules (project_id, name, metric_type, threshold, comparison, time_window_mins, channel, target, active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
	`, in.ProjectID, in.Name, in.MetricType, in.Threshold, in.Comparison, in.TimeWindowMins, in.Channel, in.Target)
	if err != nil {
		return CreateAlertRuleOutput{}, fmt.Errorf("failed to create alert rule: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return CreateAlertRuleOutput{}, err
	}
	a.recordAuditLog(ctx, "Create Alert Rule", fmt.Sprintf("Created alert rule '%s' for project ID %d", in.Name, in.ProjectID))
	return CreateAlertRuleOutput{Success: true, ID: int(id)}, nil
}

func (a *APIHandler) ListAlertRules(ctx context.Context, in ListAlertRulesInput) (ListAlertRulesOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return ListAlertRulesOutput{}, fmt.Errorf("unauthorized")
	}
	rows, err := a.db.QueryContext(ctx, `
		SELECT id, project_id, name, metric_type, threshold, comparison, time_window_mins, channel, target, active, created_at
		FROM alert_rules WHERE project_id = ? ORDER BY created_at DESC
	`, in.ProjectID)
	if err != nil {
		return ListAlertRulesOutput{}, fmt.Errorf("failed to list alert rules: %w", err)
	}
	defer rows.Close()

	var rules []AlertRule
	for rows.Next() {
		var r AlertRule
		err := rows.Scan(&r.ID, &r.ProjectID, &r.Name, &r.MetricType, &r.Threshold, &r.Comparison, &r.TimeWindowMins, &r.Channel, &r.Target, &r.Active, &r.CreatedAt)
		if err != nil {
			return ListAlertRulesOutput{}, err
		}
		rules = append(rules, r)
	}
	if rules == nil {
		rules = []AlertRule{}
	}
	return ListAlertRulesOutput{Rules: rules}, nil
}

func (a *APIHandler) ToggleAlertRule(ctx context.Context, in ToggleAlertRuleInput) (ToggleAlertRuleOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return ToggleAlertRuleOutput{}, fmt.Errorf("unauthorized")
	}
	_, err := a.db.ExecContext(ctx, "UPDATE alert_rules SET active = ? WHERE id = ?", in.Active, in.ID)
	if err != nil {
		return ToggleAlertRuleOutput{}, fmt.Errorf("failed to toggle alert rule: %w", err)
	}
	a.recordAuditLog(ctx, "Toggle Alert Rule", fmt.Sprintf("Toggled alert rule ID %d active=%d", in.ID, in.Active))
	return ToggleAlertRuleOutput{Success: true}, nil
}

func (a *APIHandler) DeleteAlertRule(ctx context.Context, in DeleteAlertRuleInput) (DeleteAlertRuleOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return DeleteAlertRuleOutput{}, fmt.Errorf("unauthorized")
	}
	_, err := a.db.ExecContext(ctx, "DELETE FROM alert_rules WHERE id = ?", in.ID)
	if err != nil {
		return DeleteAlertRuleOutput{}, fmt.Errorf("failed to delete alert rule: %w", err)
	}
	a.recordAuditLog(ctx, "Delete Alert Rule", fmt.Sprintf("Deleted alert rule ID %d", in.ID))
	return DeleteAlertRuleOutput{Success: true}, nil
}

func (a *APIHandler) QueryAlertsHistory(ctx context.Context, in QueryAlertsHistoryInput) (QueryAlertsHistoryOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return QueryAlertsHistoryOutput{}, fmt.Errorf("unauthorized")
	}
	rows, err := a.db.QueryContext(ctx, `
		SELECT h.id, h.rule_id, r.name, r.metric_type, h.triggered_value, r.threshold, r.comparison, h.triggered_at
		FROM alerts_history h
		JOIN alert_rules r ON h.rule_id = r.id
		WHERE h.project_id = ?
		ORDER BY h.triggered_at DESC LIMIT 100
	`, in.ProjectID)
	if err != nil {
		return QueryAlertsHistoryOutput{}, fmt.Errorf("failed to query alert history: %w", err)
	}
	defer rows.Close()

	var history []AlertHistoryEntry
	for rows.Next() {
		var h AlertHistoryEntry
		err := rows.Scan(&h.ID, &h.RuleID, &h.RuleName, &h.MetricType, &h.TriggeredValue, &h.Threshold, &h.Comparison, &h.TriggeredAt)
		if err != nil {
			return QueryAlertsHistoryOutput{}, err
		}
		history = append(history, h)
	}
	if history == nil {
		history = []AlertHistoryEntry{}
	}
	return QueryAlertsHistoryOutput{History: history}, nil
}

// --- Dashboard RPC Handlers ---

func (a *APIHandler) SaveDashboard(ctx context.Context, in SaveDashboardInput) (SaveDashboardOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return SaveDashboardOutput{}, fmt.Errorf("unauthorized")
	}
	// Check if exists
	var id int
	err := a.db.QueryRowContext(ctx, "SELECT id FROM dashboards WHERE project_id = ? AND name = ?", in.ProjectID, in.Name).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			res, err := a.db.ExecContext(ctx, "INSERT INTO dashboards (project_id, name, layout) VALUES (?, ?, ?)", in.ProjectID, in.Name, in.Layout)
			if err != nil {
				return SaveDashboardOutput{}, err
			}
			newID, _ := res.LastInsertId()
			a.recordAuditLog(ctx, "Create Dashboard", fmt.Sprintf("Created dashboard '%s'", in.Name))
			return SaveDashboardOutput{Success: true, ID: int(newID)}, nil
		}
		return SaveDashboardOutput{}, err
	}
	_, err = a.db.ExecContext(ctx, "UPDATE dashboards SET layout = ? WHERE id = ?", in.Layout, id)
	if err != nil {
		return SaveDashboardOutput{}, err
	}
	a.recordAuditLog(ctx, "Update Dashboard", fmt.Sprintf("Updated dashboard '%s'", in.Name))
	return SaveDashboardOutput{Success: true, ID: id}, nil
}

func (a *APIHandler) GetDashboards(ctx context.Context, in GetDashboardsInput) (GetDashboardsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return GetDashboardsOutput{}, fmt.Errorf("unauthorized")
	}
	rows, err := a.db.QueryContext(ctx, "SELECT id, project_id, name, layout, created_at FROM dashboards WHERE project_id = ?", in.ProjectID)
	if err != nil {
		return GetDashboardsOutput{}, err
	}
	defer rows.Close()

	var dashboards []Dashboard
	for rows.Next() {
		var d Dashboard
		if err := rows.Scan(&d.ID, &d.ProjectID, &d.Name, &d.Layout, &d.CreatedAt); err != nil {
			return GetDashboardsOutput{}, err
		}
		dashboards = append(dashboards, d)
	}
	if dashboards == nil {
		dashboards = []Dashboard{}
	}
	return GetDashboardsOutput{Dashboards: dashboards}, nil
}

// --- Incident RPC Handlers ---

func (a *APIHandler) CreateIncident(ctx context.Context, in CreateIncidentInput) (CreateIncidentOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return CreateIncidentOutput{}, fmt.Errorf("unauthorized")
	}
	res, err := a.db.ExecContext(ctx, `
		INSERT INTO incidents (project_id, title, status, severity, description)
		VALUES (?, ?, 'open', ?, ?)
	`, in.ProjectID, in.Title, in.Severity, in.Description)
	if err != nil {
		return CreateIncidentOutput{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return CreateIncidentOutput{}, err
	}
	// Add initial update
	_, _ = a.db.ExecContext(ctx, "INSERT INTO incident_updates (incident_id, message, status) VALUES (?, 'Incident created.', 'open')", id)
	a.recordAuditLog(ctx, "Create Incident", fmt.Sprintf("Created incident '%s' with severity %s", in.Title, in.Severity))
	return CreateIncidentOutput{Success: true, ID: int(id)}, nil
}

func (a *APIHandler) UpdateIncidentStatus(ctx context.Context, in UpdateIncidentStatusInput) (UpdateIncidentStatusOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return UpdateIncidentStatusOutput{}, fmt.Errorf("unauthorized")
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return UpdateIncidentStatusOutput{}, err
	}
	defer tx.Rollback()

	var query string
	if in.Status == "resolved" {
		query = "UPDATE incidents SET status = ?, resolved_at = datetime('now') WHERE id = ?"
	} else {
		query = "UPDATE incidents SET status = ? WHERE id = ?"
	}
	_, err = tx.ExecContext(ctx, query, in.Status, in.ID)
	if err != nil {
		return UpdateIncidentStatusOutput{}, err
	}

	_, err = tx.ExecContext(ctx, "INSERT INTO incident_updates (incident_id, message, status) VALUES (?, ?, ?)", in.ID, in.Message, in.Status)
	if err != nil {
		return UpdateIncidentStatusOutput{}, err
	}

	if err := tx.Commit(); err != nil {
		return UpdateIncidentStatusOutput{}, err
	}

	a.recordAuditLog(ctx, "Update Incident", fmt.Sprintf("Updated incident ID %d to status %s: %s", in.ID, in.Status, in.Message))
	return UpdateIncidentStatusOutput{Success: true}, nil
}

func (a *APIHandler) ListIncidents(ctx context.Context, in ListIncidentsInput) (ListIncidentsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return ListIncidentsOutput{}, fmt.Errorf("unauthorized")
	}

	rows, err := a.db.QueryContext(ctx, `
		SELECT id, project_id, title, status, severity, description, created_at, resolved_at
		FROM incidents WHERE project_id = ? ORDER BY created_at DESC
	`, in.ProjectID)
	if err != nil {
		return ListIncidentsOutput{}, err
	}
	defer rows.Close()

	var incidents []Incident
	for rows.Next() {
		var inc Incident
		var resolvedAtVal sql.NullString
		err := rows.Scan(&inc.ID, &inc.ProjectID, &inc.Title, &inc.Status, &inc.Severity, &inc.Description, &inc.CreatedAt, &resolvedAtVal)
		if err != nil {
			return ListIncidentsOutput{}, err
		}
		if resolvedAtVal.Valid {
			val := resolvedAtVal.String
			inc.ResolvedAt = &val
		}
		incidents = append(incidents, inc)
	}

	// Fetch updates for each incident
	for i := range incidents {
		upRows, err := a.db.QueryContext(ctx, `
			SELECT id, incident_id, message, status, created_at
			FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC
		`, incidents[i].ID)
		if err != nil {
			return ListIncidentsOutput{}, err
		}
		var updates []IncidentUpdate
		for upRows.Next() {
			var up IncidentUpdate
			if err := upRows.Scan(&up.ID, &up.IncidentID, &up.Message, &up.Status, &up.CreatedAt); err == nil {
				updates = append(updates, up)
			}
		}
		upRows.Close()
		if updates == nil {
			updates = []IncidentUpdate{}
		}
		incidents[i].Updates = updates
	}

	if incidents == nil {
		incidents = []Incident{}
	}
	return ListIncidentsOutput{Incidents: incidents}, nil
}

// --- Audit Trail RPC Handler ---

func (a *APIHandler) QueryAuditLogs(ctx context.Context, in QueryAuditLogsInput) (QueryAuditLogsOutput, error) {
	_, _, ok := middleware.GetUserFromContext(ctx)
	if !ok {
		return QueryAuditLogsOutput{}, fmt.Errorf("unauthorized")
	}

	rows, err := a.db.QueryContext(ctx, `
		SELECT l.id, l.user_id, u.name, l.action, l.details, l.created_at
		FROM audit_logs l
		JOIN users u ON l.user_id = u.id
		ORDER BY l.created_at DESC LIMIT 200
	`)
	if err != nil {
		return QueryAuditLogsOutput{}, err
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		if err := rows.Scan(&log.ID, &log.UserID, &log.UserName, &log.Action, &log.Details, &log.CreatedAt); err == nil {
			logs = append(logs, log)
		}
	}
	if logs == nil {
		logs = []AuditLog{}
	}
	return QueryAuditLogsOutput{Logs: logs}, nil
}
