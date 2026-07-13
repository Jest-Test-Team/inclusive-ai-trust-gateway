// Package postgres provides the pgx connection pool and startup migration
// runner for the gateway's persistent repositories.
//
// The canonical migrations live in infra/database/migrations; this package
// embeds a byte-for-byte copy (see migrations/) so the container can
// self-migrate on boot — Choreo has no separate migration step. Keep the
// two directories in sync when adding migrations.
package postgres

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// Connect opens a pool against databaseURL (Neon pooled URLs supported).
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse DATABASE_URL: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres: ping: %w", err)
	}
	return pool, nil
}

// Migrate applies the embedded idempotent migrations in filename order.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	for _, name := range names {
		sql, err := migrationFS.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			// Role/RLS migrations need owner-level privileges the runtime
			// user may lack (e.g. Neon pooled role); they are advisory for
			// the app itself, so log and continue rather than block boot.
			if strings.Contains(name, "security") {
				slog.Warn("postgres: security migration skipped", "file", name, "err", err)
				continue
			}
			return fmt.Errorf("postgres: migration %s: %w", name, err)
		}
	}
	return nil
}
