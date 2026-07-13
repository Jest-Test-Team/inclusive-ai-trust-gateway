// Package domain holds value objects shared across gateway modules.
// Value objects enforce their invariants at construction time so the rest
// of the codebase never handles an out-of-range score or unknown severity.
package domain

import "fmt"

// Score is a 0-100 trust metric value object.
type Score int

// NewScore rejects out-of-range values; use ClampScore for computed inputs.
func NewScore(v int) (Score, error) {
	if v < 0 || v > 100 {
		return 0, fmt.Errorf("score %d outside [0,100]", v)
	}
	return Score(v), nil
}

// ClampScore folds arbitrary computed values into the valid range.
func ClampScore(v float64) Score {
	r := int(v + 0.5)
	if r < 0 {
		return 0
	}
	if r > 100 {
		return 100
	}
	return Score(r)
}

func (s Score) Int() int { return int(s) }

// RiskLabel is the human-readable fairness-risk band.
type RiskLabel string

const (
	RiskLow    RiskLabel = "Low"
	RiskMedium RiskLabel = "Medium"
	RiskHigh   RiskLabel = "High"
)

// RiskInputs carries the fallback-model signals that feed fairness risk.
type RiskInputs struct {
	Inclusion         Score
	UnresolvedGaps    int
	TotalBarriers     int
	OpenDataReadiness Score
}

// RiskScore converts structural inclusion gaps into a 0-100 numeric risk
// exposed by the API (higher = riskier). Inclusion saturation no longer
// collapses every well-modeled use case to the same gap-only score.
func RiskScore(inputs RiskInputs) Score {
	inclusionDeficit := float64(100-inputs.Inclusion.Int()) * 0.5

	gapPenalty := inputs.UnresolvedGaps * 8
	if gapPenalty < 0 {
		gapPenalty = 0
	}
	if gapPenalty > 48 {
		gapPenalty = 48
	}

	barrierLoad := int(float64(inputs.TotalBarriers)*2.5 + 0.5)
	if barrierLoad > 25 {
		barrierLoad = 25
	}

	openDataResidual := float64(100-inputs.OpenDataReadiness.Int()) * 0.15

	return ClampScore(inclusionDeficit + float64(gapPenalty) + float64(barrierLoad) + openDataResidual)
}

// RiskLabelFor maps a numeric risk score to Low / Medium / High bands,
// aligned with the ERH engine client thresholds.
func RiskLabelFor(risk Score) RiskLabel {
	switch {
	case risk.Int() <= 33:
		return RiskLow
	case risk.Int() <= 66:
		return RiskMedium
	default:
		return RiskHigh
	}
}

// Severity classifies ADM safety events.
type Severity string

const (
	SeverityLow      Severity = "low"
	SeverityMedium   Severity = "medium"
	SeverityHigh     Severity = "high"
	SeverityCritical Severity = "critical"
)

func ParseSeverity(v string) (Severity, error) {
	switch Severity(v) {
	case SeverityLow, SeverityMedium, SeverityHigh, SeverityCritical:
		return Severity(v), nil
	}
	return "", fmt.Errorf("unknown severity %q", v)
}
