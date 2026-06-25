package handler

import (
	"context"
	"database/sql"
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

// --- Query Event Stubs (Implemented in Part 5 & Part 6) ---

func (a *APIHandler) QueryLogs(ctx context.Context, in QueryLogsInput) (QueryLogsOutput, error) {
	return QueryLogsOutput{Logs: []LogEvent{}}, nil
}

func (a *APIHandler) GetLogHistogram(ctx context.Context, in GetLogHistogramInput) (GetLogHistogramOutput, error) {
	return GetLogHistogramOutput{Buckets: []HistogramBucket{}}, nil
}

func (a *APIHandler) QueryErrors(ctx context.Context, in QueryErrorsInput) (QueryErrorsOutput, error) {
	return QueryErrorsOutput{Errors: []ErrorGroup{}}, nil
}

func (a *APIHandler) GetErrorDetails(ctx context.Context, in GetErrorDetailsInput) (GetErrorDetailsOutput, error) {
	return GetErrorDetailsOutput{Errors: []LogEvent{}}, nil
}

func (a *APIHandler) QueryMetrics(ctx context.Context, in QueryMetricsInput) (QueryMetricsOutput, error) {
	return QueryMetricsOutput{Points: []MetricDataPoint{}}, nil
}

func (a *APIHandler) GenerateDemoData(ctx context.Context, in EmptyInput) (EmptyInput, error) {
	return EmptyInput{}, nil
}

// Hello returns a simple greeting.
func (a *APIHandler) Hello(ctx context.Context, in HelloInput) (HelloOutput, error) {
	return HelloOutput{
		Message:   fmt.Sprintf("Hello, %s!", in.Name),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
