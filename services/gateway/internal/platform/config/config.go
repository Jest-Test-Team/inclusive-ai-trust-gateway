// Package config loads gateway configuration from the environment.
package config

import (
	"os"
	"time"
)

type Config struct {
	Port              string        // GATEWAY_PORT
	APIKey            string        // GATEWAY_API_KEY — agency auth for /v1
	ERHServiceURL     string        // ERH_SERVICE_URL / ERH_API_BASE_URL — erh-engine base URL
	RedisURL          string        // REDIS_URL — empty = in-process event bus
	DatabaseURL       string        // DATABASE_URL / NEON_DATABASE_URL — empty = in-memory repositories
	AutoMigrate       bool          // AUTO_MIGRATE — apply embedded migrations on boot (default true)
	AutoReassessStale bool          // AUTO_REASSESS_STALE — re-score legacy 12/100 rows on boot
	WebhookSecret     string        // WEBHOOK_SECRET — HMAC key for outbound webhooks
	ERHTimeout        time.Duration // ERH_TIMEOUT
}

func Load() Config {
	return Config{
		Port:              getenv("GATEWAY_PORT", "8080"),
		APIKey:            getenv("GATEWAY_API_KEY", "dev-key"),
		ERHServiceURL:     firstEnv("ERH_SERVICE_URL", "ERH_API_BASE_URL"),
		RedisURL:          os.Getenv("REDIS_URL"),
		DatabaseURL:       firstEnv("DATABASE_URL", "NEON_DATABASE_URL"),
		AutoMigrate:       getenv("AUTO_MIGRATE", "1") != "0",
		AutoReassessStale: getenv("AUTO_REASSESS_STALE", "1") != "0",
		WebhookSecret:     getenv("WEBHOOK_SECRET", "dev-webhook-secret"),
		ERHTimeout:        getDuration("ERH_TIMEOUT", 5*time.Second),
	}
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return ""
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
