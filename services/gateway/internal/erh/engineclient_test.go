package erh

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestEngineClientSpeaksCanonicalContract verifies request/response mapping
// against the vendored erh_engine schema
// (services/erh-engine/erh_engine/contracts/schemas.py).
func TestEngineClientSpeaksCanonicalContract(t *testing.T) {
	var gotReq struct {
		Samples []struct {
			ID         string  `json:"id"`
			Complexity float64 `json:"complexity"`
			Value      float64 `json:"value"`
			Judgment   float64 `json:"judgment"`
			Weight     float64 `json:"weight"`
		} `json:"samples"`
		JudgeName string `json:"judge_name"`
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/evaluate" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&gotReq); err != nil {
			t.Errorf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"erh_satisfied": false, "risk_score": 71.4, "violation_rate": 0.4,
			"max_ratio": 2.1, "bound_value": 1.0, "estimated_exponent": 1.2,
			"r_squared": 0.9, "num_samples": 2, "num_primes": 1, "bound_type": "riemann",
		})
	}))
	defer srv.Close()

	client := NewEngineClient(srv.URL, 2*time.Second)
	res, err := client.Evaluate(context.Background(), careNavigation, admSignals)
	if err != nil {
		t.Fatal(err)
	}

	if len(gotReq.Samples) != 2 {
		t.Fatalf("samples = %d, want one per persona", len(gotReq.Samples))
	}
	for _, s := range gotReq.Samples {
		if s.Value < -1 || s.Value > 1 || s.Judgment < -1 || s.Judgment > 1 {
			t.Errorf("sample %s outside [-1,1]: %+v", s.ID, s)
		}
		if s.Complexity < 1 || s.Weight <= 0 {
			t.Errorf("sample %s has invalid complexity/weight: %+v", s.ID, s)
		}
	}
	if gotReq.JudgeName != careNavigation.Name {
		t.Errorf("judge_name = %q", gotReq.JudgeName)
	}

	if res.Evaluator != "erh-engine" {
		t.Errorf("evaluator = %s", res.Evaluator)
	}
	if res.FairnessRiskScore != 71 {
		t.Errorf("fairness risk = %d, want 71 (rounded risk_score)", res.FairnessRiskScore)
	}
	if res.FairnessRiskLabel != "High" {
		t.Errorf("label = %s, want High for unsatisfied ERH at 71", res.FairnessRiskLabel)
	}
	// Readiness dimensions still come from the deterministic model.
	if res.OpenDataReadiness != 66 || res.AgentSafetyReadiness != 84 {
		t.Errorf("readiness = %d/%d, want deterministic 66/84", res.OpenDataReadiness, res.AgentSafetyReadiness)
	}
}
