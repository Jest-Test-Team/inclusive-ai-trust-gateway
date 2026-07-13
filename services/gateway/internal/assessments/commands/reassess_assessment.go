package commands

import (
	"context"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
)

// ReassessAssessment re-runs the evaluator against a stored use case and
// updates the persisted scores (e.g. after the fallback formula changes).
type ReassessAssessment struct {
	ID            string
	SafetySignals []erh.SafetySignal
}

type ReassessAssessmentHandler struct {
	Repo      assessments.Repository
	Evaluator erh.Evaluator
}

func (h ReassessAssessmentHandler) Handle(ctx context.Context, cmd ReassessAssessment) (assessments.Assessment, error) {
	a, err := h.Repo.Get(ctx, cmd.ID)
	if err != nil {
		return assessments.Assessment{}, err
	}
	result, err := h.Evaluator.Evaluate(ctx, a.UseCase, cmd.SafetySignals)
	if err != nil {
		return assessments.Assessment{}, err
	}
	a.Result = result
	if err := h.Repo.Update(ctx, a); err != nil {
		return assessments.Assessment{}, err
	}
	return a, nil
}
