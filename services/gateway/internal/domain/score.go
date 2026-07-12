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

// RiskLabelFor mirrors the banding used by the original MVP dashboard:
// high inclusion with few unresolved gaps is Low risk.
func RiskLabelFor(inclusion Score, unresolvedGaps int) RiskLabel {
	switch {
	case inclusion >= 82 && unresolvedGaps <= 2:
		return RiskLow
	case inclusion >= 64:
		return RiskMedium
	default:
		return RiskHigh
	}
}

// RiskScore converts the band inputs into a 0-100 numeric risk exposed by the
// API (higher = riskier), so clients can chart it alongside the other scores.
func RiskScore(inclusion Score, unresolvedGaps int) Score {
	penalty := unresolvedGaps * 4
	if penalty > 40 {
		penalty = 40
	}
	return ClampScore(float64(100-inclusion.Int()) * 0.6 + float64(penalty))
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
