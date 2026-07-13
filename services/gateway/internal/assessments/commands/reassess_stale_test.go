package commands

import (
	"context"
	"testing"
	"time"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
)

func TestReassessStaleUpdatesLegacyRows(t *testing.T) {
	repo := assessments.NewMemoryRepository()
	ctx := context.Background()
	stale := assessments.Assessment{
		ID: "legacy-1",
		UseCase: erh.UseCase{
			Name:            "Inclusive Care Navigation",
			Domain:          "Care Services",
			OpenDataSources: []string{"care directories", "transport feeds", "demographics"},
			Safeguards:      []string{"human review", "accessibility checks", "data minimization"},
			Personas: []erh.Persona{
				{Label: "Rural older adult", Barriers: []string{"low digital literacy", "limited broadband", "complex forms"}},
				{Label: "Working caregiver", Barriers: []string{"time constraints", "fragmented agencies", "unclear next steps"}},
			},
		},
		Result: erh.Result{
			InclusionScore:       100,
			FairnessRiskScore:    12,
			FairnessRiskLabel:    "Medium",
			OpenDataReadiness:    66,
			AgentSafetyReadiness: 84,
			Evaluator:            "deterministic-fallback",
		},
		CreatedAt: time.Now().UTC(),
	}
	if err := repo.Create(ctx, stale); err != nil {
		t.Fatal(err)
	}

	handler := ReassessStaleHandler{Repo: repo, Evaluator: erh.Fallback{}}
	signals := []erh.SafetySignal{
		{Control: "prompt-injection monitoring", Status: "ready"},
		{Control: "tool-call policy", Status: "ready"},
		{Control: "containment", Status: "partial"},
		{Control: "provenance", Status: "partial"},
	}
	result, err := handler.Handle(ctx, ReassessStale{Limit: 10, SafetySignals: signals})
	if err != nil {
		t.Fatal(err)
	}
	if result.Updated != 1 {
		t.Fatalf("updated = %d, want 1", result.Updated)
	}
	if result.Items[0].Result.FairnessRiskScore == 12 {
		t.Fatalf("fairness risk still 12 after reassess")
	}
}
