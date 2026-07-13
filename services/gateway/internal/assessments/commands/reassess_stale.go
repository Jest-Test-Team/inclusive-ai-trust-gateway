package commands

import (
	"context"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
)

// ReassessStale re-scores assessments that still carry the legacy fallback
// fingerprint (deterministic-fallback + fairness_risk = 12).
type ReassessStale struct {
	Limit         int
	SafetySignals []erh.SafetySignal
}

// ReassessStaleResult summarizes a batch re-score run.
type ReassessStaleResult struct {
	Updated int
	Items   []assessments.Assessment
}

type ReassessStaleHandler struct {
	Repo      assessments.Repository
	Evaluator erh.Evaluator
}

func (h ReassessStaleHandler) Handle(ctx context.Context, cmd ReassessStale) (ReassessStaleResult, error) {
	limit := cmd.Limit
	if limit <= 0 {
		limit = 100
	}
	stale, err := h.Repo.ListStale(ctx, limit)
	if err != nil {
		return ReassessStaleResult{}, err
	}
	out := ReassessStaleResult{Items: make([]assessments.Assessment, 0, len(stale))}
	for _, a := range stale {
		result, evalErr := h.Evaluator.Evaluate(ctx, a.UseCase, cmd.SafetySignals)
		if evalErr != nil {
			return ReassessStaleResult{}, evalErr
		}
		a.Result = result
		if err := h.Repo.Update(ctx, a); err != nil {
			return ReassessStaleResult{}, err
		}
		out.Updated++
		out.Items = append(out.Items, a)
	}
	return out, nil
}
