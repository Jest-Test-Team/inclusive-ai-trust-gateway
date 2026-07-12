// Package middleware holds cross-cutting chi middleware for the gateway.
package middleware

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
)

// APIKey guards /v1 routes with the agency key carried in X-Api-Key.
func APIKey(key string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			provided := r.Header.Get("X-Api-Key")
			if provided == "" || subtle.ConstantTimeCompare([]byte(provided), []byte(key)) != 1 {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "missing or invalid API key"})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
