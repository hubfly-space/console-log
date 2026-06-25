package middleware

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiter implements a token bucket rate limiter per IP address.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     float64
	burst    int
}

type visitor struct {
	tokens   float64
	lastSeen time.Time
}

// NewRateLimiter creates a new rate limiter with the given rate (requests per second) and burst size.
func NewRateLimiter(rps float64, burst int) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rps,
		burst:    burst,
	}

	// Cleanup stale visitors every minute
	go rl.cleanup()

	return rl
}

// RateLimit creates an HTTP middleware that limits requests per IP.
func RateLimit(rps float64, burst int) Middleware {
	limiter := NewRateLimiter(rps, burst)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := extractIP(r)

			if !limiter.Allow(ip) {
				w.Header().Set("Retry-After", "1")
				http.Error(w, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Allow checks if a request from the given key is allowed.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[key]
	now := time.Now()

	if !exists {
		rl.visitors[key] = &visitor{
			tokens:   float64(rl.burst) - 1,
			lastSeen: now,
		}
		return true
	}

	// Refill tokens based on elapsed time
	elapsed := now.Sub(v.lastSeen).Seconds()
	v.tokens += elapsed * rl.rate

	if v.tokens > float64(rl.burst) {
		v.tokens = float64(rl.burst)
	}

	v.lastSeen = now

	if v.tokens < 1 {
		return false
	}

	v.tokens--
	return true
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-3 * time.Minute)
		for key, v := range rl.visitors {
			if v.lastSeen.Before(cutoff) {
				delete(rl.visitors, key)
			}
		}
		rl.mu.Unlock()
	}
}

func extractIP(r *http.Request) string {
	// Check common proxy headers
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the chain
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}

	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	addr := r.RemoteAddr
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return addr
}
