// Package app wires the gateway's dependency graph: config → platform
// services → CQRS handlers → protocol adapters. main.go and tests both build
// from here so wiring is exercised by the test suite.
package app

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/commands"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/queries"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/commerce"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/config"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/postgres"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/webhooks"
)

type App struct {
	Cfg       config.Config
	Bus       *cqrs.Bus
	Events    eventbus.Bus
	Webhooks  *webhooks.Dispatcher
	Commerce  *commerce.Service
	Evaluator erh.Evaluator
	ERHClient *erh.EngineClient
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
	var erhClient *erh.EngineClient
	if cfg.ERHServiceURL != "" {
		erhClient = erh.NewEngineClient(cfg.ERHServiceURL, cfg.ERHTimeout)
		evaluator = erh.Resilient{
			Primary:  erhClient,
			Fallback: erh.Fallback{},
		}
		ctx, cancel := context.WithTimeout(context.Background(), cfg.ERHTimeout)
		if err := erhClient.Ping(ctx); err != nil {
			slog.Warn("erh-engine unreachable at startup; assessments will use fallback until engine is healthy", "url", cfg.ERHServiceURL, "err", err)
		} else {
			slog.Info("erh-engine connected", "url", cfg.ERHServiceURL)
		}
		cancel()
	} else {
		slog.Warn("ERH_SERVICE_URL unset; assessments use deterministic-fallback scoring only")
	}

	hooks := webhooks.NewDispatcher(cfg.WebhookSecret)

	// Persistence: Postgres (Neon in prod) when DATABASE_URL is set, with a
	// hard fallback to memory so the demo never dies with the database.
	var repo assessments.Repository = assessments.NewMemoryRepository()
	var store adm.Store = adm.NewMemoryStore()
	var commerceStore commerce.Store = commerce.NopStore{}
	usingPostgres := false
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
			commerceStore = commerce.NewPostgresStore(pool)
			usingPostgres = true
			slog.Info("postgres repositories active")
		}
	}

	ucp := commerce.NewServiceWithStore(events, commerceStore)

	bus := cqrs.NewBus()
	cqrs.Register[commands.CreateAssessment, assessments.Assessment](bus, commands.CreateAssessmentHandler{
		Repo: repo, Evaluator: evaluator, Bus: events, Webhooks: hooks,
	})
	cqrs.Register[commands.ReassessAssessment, assessments.Assessment](bus, commands.ReassessAssessmentHandler{
		Repo: repo, Evaluator: evaluator,
	})
	cqrs.Register[commands.ReassessStale, commands.ReassessStaleResult](bus, commands.ReassessStaleHandler{
		Repo: repo, Evaluator: evaluator,
	})
	cqrs.Register[queries.GetAssessment, assessments.Assessment](bus, queries.GetAssessmentHandler{Repo: repo})
	cqrs.Register[queries.ListAssessments, []assessments.Assessment](bus, queries.ListAssessmentsHandler{Repo: repo})
	cqrs.Register[queries.CountAssessments, int](bus, queries.CountAssessmentsHandler{Repo: repo})
	cqrs.Register[adm.IngestEvent, adm.SafetyEvent](bus, adm.IngestEventHandler{Store: store, Bus: events})
	cqrs.Register[adm.ListEvents, []adm.SafetyEvent](bus, adm.ListEventsHandler{Store: store})
	cqrs.Register[adm.CountEventsByType, map[string]int](bus, adm.CountEventsByTypeHandler{Store: store})

	if cfg.AutoReassessStale && usingPostgres {
		go reassessStaleOnBoot(bus, defaultSafetySignals())
	}

	return &App{Cfg: cfg, Bus: bus, Events: events, Webhooks: hooks, Commerce: ucp, Evaluator: evaluator, ERHClient: erhClient}
}

func reassessStaleOnBoot(bus *cqrs.Bus, signals []erh.SafetySignal) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	result, err := cqrs.Dispatch[commands.ReassessStale, commands.ReassessStaleResult](
		ctx, bus, commands.ReassessStale{Limit: 200, SafetySignals: signals},
	)
	if err != nil {
		slog.Warn("auto reassess stale assessments failed", "err", err)
		return
	}
	if result.Updated > 0 {
		slog.Info("re-scored legacy assessments", "updated", result.Updated)
	}
}

func defaultSafetySignals() []erh.SafetySignal {
	return []erh.SafetySignal{
		{Control: "Prompt-injection trajectory monitoring", Status: "ready"},
		{Control: "Tool-call policy enforcement", Status: "ready"},
		{Control: "Session-bound containment", Status: "partial"},
		{Control: "Open-data provenance checks", Status: "partial"},
	}
}

func migrateIfEnabled(ctx context.Context, cfg config.Config, pool *pgxpool.Pool) error {
	if !cfg.AutoMigrate {
		return nil
	}
	return postgres.Migrate(ctx, pool)
}
