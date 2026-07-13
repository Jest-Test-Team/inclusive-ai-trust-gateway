// Package app wires the gateway's dependency graph: config → platform
// services → CQRS handlers → protocol adapters. main.go and tests both build
// from here so wiring is exercised by the test suite.
package app

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/commands"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/queries"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/config"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/postgres"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/webhooks"
)

type App struct {
	Cfg      config.Config
	Bus      *cqrs.Bus
	Events   eventbus.Bus
	Webhooks *webhooks.Dispatcher
}

func New(cfg config.Config) *App {
	events := eventbus.Bus(eventbus.NewMemory())
	if cfg.RedisURL != "" {
		if rb, err := eventbus.NewRedis(cfg.RedisURL); err == nil {
			events = rb
		} else {
			slog.Warn("redis unavailable, using in-process event bus", "err", err)
		}
	}

	var evaluator erh.Evaluator = erh.Fallback{}
	if cfg.ERHServiceURL != "" {
		evaluator = erh.Resilient{
			Primary:  erh.NewEngineClient(cfg.ERHServiceURL, cfg.ERHTimeout),
			Fallback: erh.Fallback{},
		}
	}

	hooks := webhooks.NewDispatcher(cfg.WebhookSecret)

	// Persistence: Postgres (Neon in prod) when DATABASE_URL is set, with a
	// hard fallback to memory so the demo never dies with the database.
	var repo assessments.Repository = assessments.NewMemoryRepository()
	var store adm.Store = adm.NewMemoryStore()
	if cfg.DatabaseURL != "" {
		ctx := context.Background()
		if pool, err := postgres.Connect(ctx, cfg.DatabaseURL); err != nil {
			slog.Warn("postgres unavailable, using in-memory repositories", "err", err)
		} else if migrateErr := migrateIfEnabled(ctx, cfg, pool); migrateErr != nil {
			slog.Error("postgres migrations failed, using in-memory repositories", "err", migrateErr)
			pool.Close()
		} else {
			repo = assessments.NewPostgresRepository(pool)
			store = adm.NewPostgresStore(pool)
			slog.Info("postgres repositories active")
		}
	}

	bus := cqrs.NewBus()
	cqrs.Register[commands.CreateAssessment, assessments.Assessment](bus, commands.CreateAssessmentHandler{
		Repo: repo, Evaluator: evaluator, Bus: events, Webhooks: hooks,
	})
	cqrs.Register[queries.GetAssessment, assessments.Assessment](bus, queries.GetAssessmentHandler{Repo: repo})
	cqrs.Register[queries.ListAssessments, []assessments.Assessment](bus, queries.ListAssessmentsHandler{Repo: repo})
	cqrs.Register[adm.IngestEvent, adm.SafetyEvent](bus, adm.IngestEventHandler{Store: store, Bus: events})
	cqrs.Register[adm.ListEvents, []adm.SafetyEvent](bus, adm.ListEventsHandler{Store: store})

	return &App{Cfg: cfg, Bus: bus, Events: events, Webhooks: hooks}
}

func migrateIfEnabled(ctx context.Context, cfg config.Config, pool *pgxpool.Pool) error {
	if !cfg.AutoMigrate {
		return nil
	}
	return postgres.Migrate(ctx, pool)
}
