package erh

import "testing"

func TestScoreOpenDataReadinessFallsBackToCategories(t *testing.T) {
	if got := scoreOpenDataReadiness(4, nil); got != 88 {
		t.Fatalf("got %d want 88", got)
	}
}

func TestScoreOpenDataReadinessUsesMeasurements(t *testing.T) {
	ms := []OpenDataMeasurement{{
		DatasetID: "8572", RowsSampled: 100, EquityCoverage: 0, FillRate: 0.9,
		SchemaGap: true, QualityScore: 55,
	}}
	got := scoreOpenDataReadiness(4, ms)
	if got >= 88 {
		t.Fatalf("expected measured score below pure catalog floor, got %d", got)
	}
	if got < 40 {
		t.Fatalf("expected blended score not to collapse, got %d", got)
	}
}

func TestOpenDataJudgmentDeltaPenalizesGaps(t *testing.T) {
	delta := openDataJudgmentDelta([]OpenDataMeasurement{{
		RowsSampled: 10, EquityCoverage: 0, FillRate: 0.5, SchemaGap: true,
	}})
	if delta >= 0 {
		t.Fatalf("expected negative delta, got %v", delta)
	}
}

func TestToEngineSamplesIncludesOpenDataContext(t *testing.T) {
	uc := careNavigation
	uc.OpenDataMeasurements = []OpenDataMeasurement{{
		DatasetID: "8572", RowsSampled: 50, EquityCoverage: 0.1, FillRate: 0.8,
		SchemaGap: true, QualityScore: 50,
	}}
	samples := ToEngineSamples(uc)
	if len(samples) == 0 {
		t.Fatal("no samples")
	}
	if samples[0].Context["openDataMeasured"] != true {
		t.Fatalf("expected openDataMeasured context, got %+v", samples[0].Context)
	}
}
