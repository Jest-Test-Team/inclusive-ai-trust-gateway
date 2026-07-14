package erh

import (
	"context"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/domain"
)

// Fallback is the deterministic scoring model ported 1:1 from
// packages/shared/src/scoring.ts. It must stay behaviorally identical to the
// TypeScript version so web fallback mode and gateway fallback mode agree.
type Fallback struct{}

func (f Fallback) Evaluate(_ context.Context, uc UseCase, signals []SafetySignal) (Result, error) {
	return f.score(uc, signals), nil
}

func (Fallback) score(uc UseCase, signals []SafetySignal) Result {
	personaCoverage := len(uc.Personas) * 12
	barrierCoverage := 0
	totalBarriers := 0
	for _, p := range uc.Personas {
		barrierCoverage += len(p.Barriers) * 4
		totalBarriers += len(p.Barriers)
	}
	safeguardCoverage := len(uc.Safeguards) * 8
	openData := domain.ClampScore(float64(scoreOpenDataReadiness(len(uc.OpenDataSources), uc.OpenDataMeasurements)))

	ready, partial := 0, 0
	for _, s := range signals {
		switch s.Status {
		case "ready":
			ready++
		case "partial":
			partial++
		}
	}
	agentSafety := domain.ClampScore(float64(ready*28 + partial*14))

	inclusion := domain.ClampScore(
		18 + float64(personaCoverage) + float64(barrierCoverage) +
			float64(safeguardCoverage) + float64(openData.Int())*0.18,
	)

	unresolvedGaps := totalBarriers - len(uc.Safeguards)
	riskInputs := domain.RiskInputs{
		Inclusion:         inclusion,
		UnresolvedGaps:    unresolvedGaps,
		TotalBarriers:     totalBarriers,
		OpenDataReadiness: openData,
	}
	fairnessRisk := domain.RiskScore(riskInputs)

	return Result{
		InclusionScore:       inclusion.Int(),
		FairnessRiskScore:    fairnessRisk.Int(),
		FairnessRiskLabel:    string(domain.RiskLabelFor(fairnessRisk)),
		OpenDataReadiness:    openData.Int(),
		AgentSafetyReadiness: agentSafety.Int(),
		Evaluator:            "deterministic-fallback",
	}
}

// Resilient tries the engine first and falls back to deterministic scoring,
// implementing the circuit described in docs/architecture.md Layer 3.
type Resilient struct {
	Primary  Evaluator
	Fallback Evaluator
}

func (r Resilient) Evaluate(ctx context.Context, uc UseCase, signals []SafetySignal) (Result, error) {
	if r.Primary != nil {
		if res, err := r.Primary.Evaluate(ctx, uc, signals); err == nil {
			return res, nil
		}
	}
	return r.Fallback.Evaluate(ctx, uc, signals)
}
