// Package app wires the gateway's dependency graph: config → platform
// services → CQRS handlers → protocol adapters. main.go and tests both build
// from here so wiring is exercised by the test suite.
package app

import (
	"log/slog"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/commands"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/queries"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/config"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
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
	repo := assessments.NewMemoryRepository()
	store := adm.NewMemoryStore()

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
