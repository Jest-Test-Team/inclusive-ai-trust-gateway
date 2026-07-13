package erh

import (
	"context"
	"errors"
	"testing"
)

// careNavigation mirrors the first sample use case in
// packages/shared/src/sampleData.ts, and admSignals the sample safety
// signals (2 ready, 2 partial), so parity with the TS model is checkable.
var careNavigation = UseCase{
	Name:            "Inclusive Care Navigation",
	Domain:          "Care Services",
	Summary:         "AI-assisted service guidance.",
	OpenDataSources: []string{"care directories", "transport feeds", "demographics"},
	Safeguards:      []string{"human review", "accessibility checks", "data minimization"},
	Personas: []Persona{
		{Label: "Rural older adult", Barriers: []string{"low digital literacy", "limited broadband", "complex forms"}},
		{Label: "Working caregiver", Barriers: []string{"time constraints", "fragmented agencies", "unclear next steps"}},
	},
}

var admSignals = []SafetySignal{
	{Control: "prompt-injection monitoring", Status: "ready"},
	{Control: "tool-call policy", Status: "ready"},
	{Control: "containment", Status: "partial"},
	{Control: "provenance", Status: "partial"},
}

func TestFallbackParityWithSharedScoring(t *testing.T) {
	res, err := Fallback{}.Evaluate(context.Background(), careNavigation, admSignals)
	if err != nil {
		t.Fatal(err)
	}
	// Expected values computed from the TS model:
	// openData = clamp(3*22) = 66
	// agentSafety = 2*28 + 2*14 = 84
	// inclusion = clamp(18 + 2*12 + 6*4 + 3*8 + 66*0.18) = clamp(101.88) = 100
	// fairness risk = gap(24) + barrier(15) + open-data residual(5.1) = 44 -> Medium
	if res.OpenDataReadiness != 66 {
		t.Errorf("openData = %d, want 66", res.OpenDataReadiness)
	}
	if res.AgentSafetyReadiness != 84 {
		t.Errorf("agentSafety = %d, want 84", res.AgentSafetyReadiness)
	}
	if res.InclusionScore != 100 {
		t.Errorf("inclusion = %d, want 100", res.InclusionScore)
	}
	if res.FairnessRiskScore != 44 {
		t.Errorf("fairness risk score = %d, want 44", res.FairnessRiskScore)
	}
	if res.FairnessRiskLabel != "Medium" {
		t.Errorf("risk label = %s, want Medium", res.FairnessRiskLabel)
	}
	if res.Evaluator != "deterministic-fallback" {
		t.Errorf("evaluator = %s", res.Evaluator)
	}
}

func TestFallbackDegradedUseCaseIsHighRisk(t *testing.T) {
	stripped := UseCase{Name: "bare", Personas: []Persona{{Label: "p", Barriers: []string{"b1", "b2", "b3", "b4"}}}}
	res, _ := Fallback{}.Evaluate(context.Background(), stripped, nil)
	if res.FairnessRiskLabel != "High" {
		t.Errorf("risk label = %s, want High", res.FairnessRiskLabel)
	}
	if res.AgentSafetyReadiness != 0 || res.OpenDataReadiness != 0 {
		t.Error("readiness scores should be zero with no sources/signals")
	}
}

type failingEvaluator struct{}

func (failingEvaluator) Evaluate(context.Context, UseCase, []SafetySignal) (Result, error) {
	return Result{}, errors.New("engine down")
}

func TestResilientFallsBack(t *testing.T) {
	r := Resilient{Primary: failingEvaluator{}, Fallback: Fallback{}}
	res, err := r.Evaluate(context.Background(), careNavigation, admSignals)
	if err != nil {
		t.Fatal(err)
	}
	if res.Evaluator != "deterministic-fallback" {
		t.Errorf("expected fallback result, got %s", res.Evaluator)
	}
}
