// Package config loads gateway configuration from the environment.
package config

import (
	"os"
	"time"
)

type Config struct {
	Port          string        // GATEWAY_PORT
	APIKey        string        // GATEWAY_API_KEY — agency auth for /v1
	ERHServiceURL string        // ERH_SERVICE_URL — erh-engine base URL, empty = fallback scoring only
	RedisURL      string        // REDIS_URL — empty = in-process event bus
	WebhookSecret string        // WEBHOOK_SECRET — HMAC key for outbound webhooks
	ERHTimeout    time.Duration // ERH_TIMEOUT
}

func Load() Config {
	return Config{
		Port:          getenv("GATEWAY_PORT", "8080"),
		APIKey:        getenv("GATEWAY_API_KEY", "dev-key"),
		ERHServiceURL: os.Getenv("ERH_SERVICE_URL"),
		RedisURL:      os.Getenv("REDIS_URL"),
		WebhookSecret: getenv("WEBHOOK_SECRET", "dev-webhook-secret"),
		ERHTimeout:    getDuration("ERH_TIMEOUT", 5*time.Second),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
