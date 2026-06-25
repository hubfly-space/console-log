package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/bonheur/go-starter-kit/internal/database"
)

type contextKey string

const (
	ContextKeyUserID    contextKey = "user_id"
	ContextKeyUserEmail contextKey = "user_email"
	ContextKeySessionID contextKey = "session_id"
)

// Authenticate returns a middleware that extracts a session token from the Authorization header,
// validates it against the database, and injects the user's ID and email into the request context.
func Authenticate(db *database.DB) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				next.ServeHTTP(w, r)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				next.ServeHTTP(w, r)
				return
			}

			token := parts[1]

			// Query session from database
			var userID int
			var email string
			var expiresAtStr string

			err := db.QueryRowContext(r.Context(), `
				SELECT s.user_id, u.email, s.expires_at 
				FROM sessions s 
				JOIN users u ON s.user_id = u.id 
				WHERE s.id = ?`, token).Scan(&userID, &email, &expiresAtStr)

			if err != nil {
				if err != sql.ErrNoRows {
					// Don't clutter logs with invalid sessions, but log errors
					db.PingContext(r.Context()) // check connection
				}
				next.ServeHTTP(w, r)
				return
			}

			// Check expiration. SQLite might store datetime in various string formats.
			var expiresAt time.Time
			// Try RFC3339 first
			expiresAt, err = time.Parse(time.RFC3339, expiresAtStr)
			if err != nil {
				// Try datetime('now') standard format: "2006-01-02 15:04:05"
				expiresAt, err = time.Parse("2006-01-02 15:04:05", expiresAtStr)
			}

			if err != nil {
				// If we can't parse expiration, default to invalid
				next.ServeHTTP(w, r)
				return
			}

			if time.Now().After(expiresAt) {
				// Session expired
				next.ServeHTTP(w, r)
				return
			}

			// Inject user ID, email, and session ID into context
			ctx := context.WithValue(r.Context(), ContextKeyUserID, userID)
			ctx = context.WithValue(ctx, ContextKeyUserEmail, email)
			ctx = context.WithValue(ctx, ContextKeySessionID, token)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserFromContext extracts the user ID and email from the context.
func GetUserFromContext(ctx context.Context) (int, string, bool) {
	userID, ok1 := ctx.Value(ContextKeyUserID).(int)
	email, ok2 := ctx.Value(ContextKeyUserEmail).(string)
	return userID, email, ok1 && ok2
}

// GetSessionFromContext extracts the session ID from the context.
func GetSessionFromContext(ctx context.Context) (string, bool) {
	token, ok := ctx.Value(ContextKeySessionID).(string)
	return token, ok
}
