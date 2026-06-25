package middleware

import (
	"compress/gzip"
	"io"
	"net/http"
	"strings"
	"sync"
)

// gzipResponseWriter wraps http.ResponseWriter with gzip compression.
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
	wroteHeader bool
}

func (grw *gzipResponseWriter) Write(b []byte) (int, error) {
	if !grw.wroteHeader {
		// Set content type by sniffing if not already set
		if grw.Header().Get("Content-Type") == "" {
			grw.Header().Set("Content-Type", http.DetectContentType(b))
		}
		grw.wroteHeader = true
	}
	return grw.Writer.Write(b)
}

func (grw *gzipResponseWriter) WriteHeader(code int) {
	grw.Header().Del("Content-Length")
	grw.wroteHeader = true
	grw.ResponseWriter.WriteHeader(code)
}

// Compress creates a gzip compression middleware.
// level should be between gzip.BestSpeed (1) and gzip.BestCompression (9).
func Compress(level int) Middleware {
	if level < gzip.BestSpeed {
		level = gzip.BestSpeed
	}
	if level > gzip.BestCompression {
		level = gzip.BestCompression
	}

	pool := &sync.Pool{
		New: func() any {
			w, _ := gzip.NewWriterLevel(io.Discard, level)
			return w
		},
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip compression if client doesn't accept gzip
			if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
				next.ServeHTTP(w, r)
				return
			}

			gz := pool.Get().(*gzip.Writer)
			defer pool.Put(gz)

			gz.Reset(w)
			defer gz.Close()

			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Set("Vary", "Accept-Encoding")

			grw := &gzipResponseWriter{
				Writer:         gz,
				ResponseWriter: w,
			}

			next.ServeHTTP(grw, r)
		})
	}
}
