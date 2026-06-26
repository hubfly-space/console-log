package consolelog

import (
	"fmt"
	"net/http"
	"runtime/debug"
	"time"
)

// responseWriterDelegator wraps http.ResponseWriter to track response metadata.
type responseWriterDelegator struct {
	http.ResponseWriter
	status      int
	written     int64
	wroteHeader bool
}

func (w *responseWriterDelegator) WriteHeader(code int) {
	if !w.wroteHeader {
		w.status = code
		w.wroteHeader = true
		w.ResponseWriter.WriteHeader(code)
	}
}

func (w *responseWriterDelegator) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	n, err := w.ResponseWriter.Write(b)
	w.written += int64(n)
	return n, err
}

// Middleware creates a standard HTTP middleware to collect latency metrics and catch panic traces.
func Middleware(client *Client) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			
			d := &responseWriterDelegator{
				ResponseWriter: w,
				status:         http.StatusOK,
			}

			defer func() {
				duration := time.Since(start)
				
				// Capture handler panics
				if err := recover(); err != nil {
					stack := string(debug.Stack())
					
					// Enqueue fatal event
					client.Enqueue(Event{
						Type:    "error",
						Level:   "fatal",
						Message: fmt.Sprintf("Panic in HTTP Handler: %v", err),
						Payload: map[string]any{
							"path":   r.URL.Path,
							"method": r.Method,
							"stack":  stack,
							"panic":  true,
						},
					})
					
					// Return 500 error if headers not written yet
					if !d.wroteHeader {
						http.Error(d, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
					}
				}

				// Enqueue latency metrics
				client.Metric("http.request.latency_ms", float64(duration.Milliseconds()), map[string]any{
					"path":   r.URL.Path,
					"method": r.Method,
					"status": d.status,
					"bytes":  d.written,
				})
			}()

			next.ServeHTTP(d, r)
		})
	}
}
