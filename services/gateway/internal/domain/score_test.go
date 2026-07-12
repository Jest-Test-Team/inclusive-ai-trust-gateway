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
	if RiskLabelFor(90, 0) != RiskLow {
		t.Error("high inclusion, no gaps should be Low")
	}
	if RiskLabelFor(70, 5) != RiskMedium {
		t.Error("mid inclusion should be Medium")
	}
	if RiskLabelFor(30, 8) != RiskHigh {
		t.Error("low inclusion should be High")
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
