package domain

import "testing"

func TestNewScoreRejectsOutOfRange(t *testing.T) {
	for _, v := range []int{-1, 101, 500} {
		if _, err := NewScore(v); err == nil {
			t.Errorf("NewScore(%d) accepted an invalid value", v)
		}
	}
	if s, err := NewScore(100); err != nil || s.Int() != 100 {
		t.Errorf("NewScore(100) = %v, %v", s, err)
	}
}

func TestClampScore(t *testing.T) {
	cases := map[float64]Score{-5: 0, 0: 0, 49.6: 50, 100: 100, 240: 100}
	for in, want := range cases {
		if got := ClampScore(in); got != want {
			t.Errorf("ClampScore(%v) = %v, want %v", in, got, want)
		}
	}
}

func TestRiskLabelBands(t *testing.T) {
	if RiskLabelFor(Score(20)) != RiskLow {
		t.Error("risk <= 33 should be Low")
	}
	if RiskLabelFor(Score(50)) != RiskMedium {
		t.Error("risk <= 66 should be Medium")
	}
	if RiskLabelFor(Score(80)) != RiskHigh {
		t.Error("risk > 66 should be High")
	}
}

func TestRiskScoreDifferentiatesInputs(t *testing.T) {
	low := RiskScore(RiskInputs{
		Inclusion:         100,
		UnresolvedGaps:    1,
		TotalBarriers:     6,
		OpenDataReadiness: 88,
	})
	high := RiskScore(RiskInputs{
		Inclusion:         100,
		UnresolvedGaps:    5,
		TotalBarriers:     7,
		OpenDataReadiness: 88,
	})
	if low == high {
		t.Errorf("expected different risk scores, both got %d", low)
	}
}

func TestParseSeverity(t *testing.T) {
	if _, err := ParseSeverity("catastrophic"); err == nil {
		t.Error("unknown severity accepted")
	}
	if s, err := ParseSeverity("high"); err != nil || s != SeverityHigh {
		t.Errorf("ParseSeverity(high) = %v, %v", s, err)
	}
}
