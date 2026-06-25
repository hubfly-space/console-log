package middleware

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
)

// Recovery recovers from panics in HTTP handlers, logs the stack trace,
// and returns a 500 Internal Server Error response.
func Recovery(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					stack := debug.Stack()

					logger.Error("panic recovered",
						slog.String("error", fmt.Sprintf("%v", err)),
						slog.String("path", r.URL.Path),
						slog.String("method", r.Method),
						slog.String("stack", string(stack)),
					)

					http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}
