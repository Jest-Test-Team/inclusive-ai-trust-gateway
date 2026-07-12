package postgres_test

// Round-trip integration test for the Postgres repositories. Runs only when
// TEST_DATABASE_URL points at a disposable database, e.g.:
//
//	docker compose -f infra/docker/docker-compose.yml up -d postgres
//	TEST_DATABASE_URL=postgres://iatg:iatg@127.0.0.1:5432/iatg?sslmode=disable \
//	  go test ./internal/platform/postgres/

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/domain"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/postgres"
)

func TestPostgresRoundTrip(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := postgres.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := postgres.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	repo := assessments.NewPostgresRepository(pool)
	a := assessments.Assessment{
		ID: uuid.NewString(),
		UseCase: erh.UseCase{
			Name:            "Integration case",
			Domain:          "care",
			Summary:         "round-trip",
			TargetUsers:     []string{"elders"},
			SDGs:            []string{"SDG 10"},
			OpenDataSources: []string{"directories", "transport"},
			AICapabilities:  []string{"matching"},
			Safeguards:      []string{"review"},
			Personas: []erh.Persona{
				{Label: "rural elder", AgeGroup: "65+", Region: "rural", Needs: []string{"voice"}, Barriers: []string{"forms"}},
			},
		},
		Result: erh.Result{
			InclusionScore: 70, FairnessRiskScore: 30, FairnessRiskLabel: "Medium",
			OpenDataReadiness: 44, AgentSafetyReadiness: 84, Evaluator: "deterministic-fallback",
		},
		CreatedAt: time.Now().UTC().Truncate(time.Millisecond),
	}
	if err := repo.Create(ctx, a); err != nil {
		t.Fatal(err)
	}

	got, err := repo.Get(ctx, a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.UseCase.Name != a.UseCase.Name || got.Result.InclusionScore != 70 {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
	if len(got.UseCase.Personas) != 1 || got.UseCase.Personas[0].Label != "rural elder" {
		t.Fatalf("personas not restored: %+v", got.UseCase.Personas)
	}
	if len(got.UseCase.OpenDataSources) != 2 {
		t.Fatalf("open data sources not restored: %+v", got.UseCase.OpenDataSources)
	}

	list, err := repo.List(ctx, 5)
	if err != nil || len(list) == 0 {
		t.Fatalf("list: %v (%d items)", err, len(list))
	}

	if _, err := repo.Get(ctx, uuid.NewString()); err != assessments.ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}

	store := adm.NewPostgresStore(pool)
	event := adm.SafetyEvent{
		ID: uuid.NewString(), EventType: "containment", Severity: domain.SeverityCritical,
		Detail: json.RawMessage(`{"why":"integration"}`), SessionID: "s-1",
		ReceivedAt: time.Now().UTC().Truncate(time.Millisecond),
	}
	if err := store.Append(ctx, event); err != nil {
		t.Fatal(err)
	}
	events, err := store.Recent(ctx, 10)
	if err != nil || len(events) == 0 {
		t.Fatalf("recent: %v (%d events)", err, len(events))
	}
	if events[0].EventType != "containment" || events[0].SessionID != "s-1" {
		t.Fatalf("event round-trip mismatch: %+v", events[0])
	}
}
