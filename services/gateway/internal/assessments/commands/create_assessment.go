// Package commands holds the write-side CQRS objects of the assessments
// module.
package commands

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/eventbus"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/webhooks"
)

// CreateAssessment evaluates a use case and persists the result.
type CreateAssessment struct {
	UseCase       erh.UseCase
	SafetySignals []erh.SafetySignal
}

type CreateAssessmentHandler struct {
	Repo      assessments.Repository
	Evaluator erh.Evaluator
	Bus       eventbus.Bus
	Webhooks  *webhooks.Dispatcher
}

func (h CreateAssessmentHandler) Handle(ctx context.Context, cmd CreateAssessment) (assessments.Assessment, error) {
	result, err := h.Evaluator.Evaluate(ctx, cmd.UseCase, cmd.SafetySignals)
	if err != nil {
		return assessments.Assessment{}, err
	}
	a := assessments.Assessment{
		ID:        uuid.NewString(),
		UseCase:   cmd.UseCase,
		Result:    result,
		CreatedAt: time.Now().UTC(),
	}
	if err := h.Repo.Create(ctx, a); err != nil {
		return assessments.Assessment{}, err
	}

	// Fan-out is best-effort: a dead subscriber must not fail the command.
	payload, _ := json.Marshal(map[string]any{
		"id":             a.ID,
		"name":           a.UseCase.Name,
		"inclusionScore": a.Result.InclusionScore,
		"evaluator":      a.Result.Evaluator,
	})
	if h.Bus != nil {
		if err := h.Bus.Publish(ctx, eventbus.Event{Channel: "assessments.created", Payload: payload}); err != nil {
			slog.Warn("assessment event publish failed", "err", err)
		}
	}
	if h.Webhooks != nil {
		if err := h.Webhooks.Notify(ctx, "assessment.created", payload); err != nil {
			slog.Warn("assessment webhook delivery failed", "err", err)
		}
	}
	return a, nil
}
