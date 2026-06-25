package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

// responseRecorder wraps http.ResponseWriter to capture status code and bytes written.
type responseRecorder struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

func (rr *responseRecorder) Write(b []byte) (int, error) {
	n, err := rr.ResponseWriter.Write(b)
	rr.bytesWritten += n
	return n, err
}

// Logging creates structured request logging middleware using slog.
func Logging(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			rec := &responseRecorder{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(rec, r)

			duration := time.Since(start)
			requestID := w.Header().Get("X-Request-ID")

			attrs := []slog.Attr{
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rec.statusCode),
				slog.Duration("duration", duration),
				slog.Int("bytes", rec.bytesWritten),
				slog.String("remote_addr", r.RemoteAddr),
				slog.String("user_agent", r.UserAgent()),
			}

			if requestID != "" {
				attrs = append(attrs, slog.String("request_id", requestID))
			}

			if r.URL.RawQuery != "" {
				attrs = append(attrs, slog.String("query", r.URL.RawQuery))
			}

			level := slog.LevelInfo
			if rec.statusCode >= 500 {
				level = slog.LevelError
			} else if rec.statusCode >= 400 {
				level = slog.LevelWarn
			}

			logger.LogAttrs(r.Context(), level, "http request",
				attrs...,
			)
		})
	}
}
