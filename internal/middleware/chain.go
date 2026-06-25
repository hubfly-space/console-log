// Package middleware provides HTTP middleware for the server.
package middleware

import "net/http"

// Middleware represents an HTTP middleware function.
type Middleware func(http.Handler) http.Handler

// Chain creates a new middleware chain from the given middlewares.
// Middlewares are applied in the order they are provided,
// meaning the first middleware in the slice wraps the outermost layer.
func Chain(middlewares ...Middleware) Middleware {
	return func(next http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			next = middlewares[i](next)
		}
		return next
	}
}
