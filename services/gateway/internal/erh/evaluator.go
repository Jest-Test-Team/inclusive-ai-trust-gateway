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
	"strings"
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

// engineSample mirrors erh_engine's canonical Sample contract
// (services/erh-engine/erh_engine/contracts/schemas.py): complexity x,
// true value V(a), system judgment J(a), weight w(a).
type engineSample struct {
	ID         string         `json:"id"`
	Complexity float64        `json:"complexity"`
	Value      float64        `json:"value"`
	Judgment   float64        `json:"judgment"`
	Weight     float64        `json:"weight"`
	Context    map[string]any `json:"context,omitempty"`
}

type engineRequest struct {
	Samples   []engineSample `json:"samples"`
	JudgeName string         `json:"judge_name"`
}

// engineResponse mirrors erh_engine's EvaluateResponse (subset we consume).
type engineResponse struct {
	ErhSatisfied      bool    `json:"erh_satisfied"`
	RiskScore         float64 `json:"risk_score"` // 0-100, higher = unhealthier
	EstimatedExponent float64 `json:"estimated_exponent"`
	NumSamples        int     `json:"num_samples"`
	NumPrimes         int     `json:"num_primes"`
}

type EngineClient struct {
	baseURL string
	client  *http.Client
}

func NewEngineClient(baseURL string, timeout time.Duration) *EngineClient {
	return &EngineClient{baseURL: strings.TrimRight(baseURL, "/"), client: &http.Client{Timeout: timeout}}
}

// Ping checks erh-engine liveness via GET /v1/health.
func (c *EngineClient) Ping(ctx context.Context) error {
	if c == nil || c.baseURL == "" {
		return fmt.Errorf("erh-engine: not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/v1/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("erh-engine: health status %d", resp.StatusCode)
	}
	return nil
}

func (c *EngineClient) Evaluate(ctx context.Context, uc UseCase, signals []SafetySignal) (Result, error) {
	body, err := json.Marshal(engineRequest{Samples: ToEngineSamples(uc), JudgeName: uc.Name})
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

	// The engine owns fairness risk; the readiness dimensions it does not
	// score come from the deterministic model so results stay complete.
	res := Fallback{}.score(uc, signals)
	res.Evaluator = "erh-engine"
	res.FairnessRiskScore = clampRisk(er.RiskScore)
	switch {
	case er.ErhSatisfied && res.FairnessRiskScore <= 33:
		res.FairnessRiskLabel = "Low"
	case res.FairnessRiskScore <= 66:
		res.FairnessRiskLabel = "Medium"
	default:
		res.FairnessRiskLabel = "High"
	}
	return res, nil
}

// ToEngineSamples converts a use case into ERH decision samples: each
// persona is one decision, where complexity grows with barrier count, the
// true value is full service (1.0), and the judged quality degrades with
// unmitigated barriers and recovers with safeguards.
func ToEngineSamples(uc UseCase) []engineSample {
	if len(uc.Personas) == 0 {
		return []engineSample{{
			ID: "use-case", Complexity: 1, Value: 1, Judgment: 0.8, Weight: 1,
			Context: map[string]any{"name": uc.Name, "domain": uc.Domain},
		}}
	}
	samples := make([]engineSample, 0, len(uc.Personas))
	for i, p := range uc.Personas {
		judgment := 1.0 - 0.3*float64(len(p.Barriers)) + 0.1*float64(len(uc.Safeguards))
		if judgment > 1 {
			judgment = 1
		}
		if judgment < -1 {
			judgment = -1
		}
		samples = append(samples, engineSample{
			ID:         fmt.Sprintf("persona-%d", i),
			Complexity: 1 + float64(len(p.Barriers)),
			Value:      1,
			Judgment:   judgment,
			Weight:     1,
			Context: map[string]any{
				"persona": p.Label, "ageGroup": p.AgeGroup, "region": p.Region,
				"barriers": p.Barriers,
			},
		})
	}
	return samples
}

func clampRisk(v float64) int {
	r := int(v + 0.5)
	if r < 0 {
		return 0
	}
	if r > 100 {
		return 100
	}
	return r
}
