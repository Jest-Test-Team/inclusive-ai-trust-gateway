// Package erh evaluates public-service use cases for inclusion and fairness.
// The primary path calls the Ethic-Latex erh-engine service; the fallback is
// the deterministic scoring model ported from the original MVP dashboard
// (packages/shared/src/scoring.ts), so the gateway stays demoable when the
// engine container is unreachable.
package erh

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// UseCase is the evaluator's view of a public-service AI use case.
type UseCase struct {
	Name            string
	Domain          string
	Summary         string
	TargetUsers     []string
	SDGs            []string
	OpenDataSources []string
	AICapabilities  []string
	Safeguards      []string
	Personas        []Persona
}

type Persona struct {
	Label    string
	AgeGroup string
	Region   string
	Needs    []string
	Barriers []string
}

// SafetySignal summarizes one ADM control's readiness for the use case.
type SafetySignal struct {
	Control string
	Status  string // ready | partial | missing
}

// Result carries the four trust metrics plus provenance of how they were
// produced ("erh-engine" or "deterministic-fallback").
type Result struct {
	InclusionScore       int    `json:"inclusionScore"`
	FairnessRiskScore    int    `json:"fairnessRiskScore"`
	FairnessRiskLabel    string `json:"fairnessRiskLabel"`
	OpenDataReadiness    int    `json:"openDataReadiness"`
	AgentSafetyReadiness int    `json:"agentSafetyReadiness"`
	Evaluator            string `json:"evaluator"`
}

type Evaluator interface {
	Evaluate(ctx context.Context, uc UseCase, signals []SafetySignal) (Result, error)
}

// --- erh-engine HTTP client ---

// engineSample mirrors erh_engine's Sample contract: each persona/outcome
// pair becomes a sample the engine scores for cumulative ethical error.
type engineSample struct {
	ID         string         `json:"id"`
	Context    string         `json:"context"`
	Attributes map[string]any `json:"attributes"`
}

type engineRequest struct {
	Samples []engineSample `json:"samples"`
}

type engineResponse struct {
	InclusionScore       *int    `json:"inclusion_score"`
	FairnessRisk         *int    `json:"fairness_risk"`
	OpenDataReadiness    *int    `json:"open_data_readiness"`
	AgentSafetyReadiness *int    `json:"agent_safety_readiness"`
	Alpha                float64 `json:"alpha"`
}

type EngineClient struct {
	baseURL string
	client  *http.Client
}

func NewEngineClient(baseURL string, timeout time.Duration) *EngineClient {
	return &EngineClient{baseURL: baseURL, client: &http.Client{Timeout: timeout}}
}

func (c *EngineClient) Evaluate(ctx context.Context, uc UseCase, signals []SafetySignal) (Result, error) {
	samples := make([]engineSample, 0, len(uc.Personas))
	for i, p := range uc.Personas {
		samples = append(samples, engineSample{
			ID:      fmt.Sprintf("%s-%d", uc.Name, i),
			Context: uc.Summary,
			Attributes: map[string]any{
				"persona":  p.Label,
				"ageGroup": p.AgeGroup,
				"region":   p.Region,
				"needs":    p.Needs,
				"barriers": p.Barriers,
			},
		})
	}
	body, err := json.Marshal(engineRequest{Samples: samples})
	if err != nil {
		return Result{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/evaluate", bytes.NewReader(body))
	if err != nil {
		return Result{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return Result{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("erh-engine: status %d", resp.StatusCode)
	}
	var er engineResponse
	if err := json.NewDecoder(resp.Body).Decode(&er); err != nil {
		return Result{}, err
	}

	// The engine owns fairness; readiness dimensions it does not score are
	// filled from the deterministic model so the result is always complete.
	det := Fallback{}.score(uc, signals)
	res := det
	res.Evaluator = "erh-engine"
	if er.InclusionScore != nil {
		res.InclusionScore = *er.InclusionScore
	}
	if er.FairnessRisk != nil {
		res.FairnessRiskScore = *er.FairnessRisk
	}
	if er.OpenDataReadiness != nil {
		res.OpenDataReadiness = *er.OpenDataReadiness
	}
	if er.AgentSafetyReadiness != nil {
		res.AgentSafetyReadiness = *er.AgentSafetyReadiness
	}
	return res, nil
}
