package erh

// OpenDataMeasurement is a row-sample quality snapshot from a data.gov.tw CSV.
// Produced by the web metrics proxy and passed into assessment / ERH evaluate
// so open-data readiness and persona judgment reflect measured equity gaps.
type OpenDataMeasurement struct {
	DatasetID      string  `json:"datasetId"`
	CatalogID      string  `json:"catalogId"`
	ScenarioID     string  `json:"scenarioId"`
	Title          string  `json:"title"`
	RowsSampled    int     `json:"rowsSampled"`
	ColumnCount    int     `json:"columnCount"`
	EquityCoverage float64 `json:"equityCoverage"`
	FillRate       float64 `json:"fillRate"`
	SchemaGap      bool    `json:"schemaGap"`
	QualityScore   int     `json:"qualityScore"`
	Error          string  `json:"error,omitempty"`
}

func openDataJudgmentDelta(ms []OpenDataMeasurement) float64 {
	ok := filterMeasured(ms)
	if len(ms) == 0 {
		return 0
	}
	if len(ok) == 0 {
		return -0.05
	}
	var meanEquity, meanFill float64
	gaps := 0
	for _, m := range ok {
		meanEquity += m.EquityCoverage
		meanFill += m.FillRate
		if m.SchemaGap {
			gaps++
		}
	}
	n := float64(len(ok))
	meanEquity /= n
	meanFill /= n
	gapRate := float64(gaps) / n
	return -((1-meanEquity)*0.2 + (1-meanFill)*0.08 + gapRate*0.12)
}

func scoreOpenDataReadiness(sourceCategories int, ms []OpenDataMeasurement) int {
	categoryFloor := clampScoreInt(sourceCategories * 22)
	if len(ms) == 0 {
		return categoryFloor
	}
	ok := filterMeasured(ms)
	if len(ok) == 0 {
		return clampScoreInt(int(float64(categoryFloor) * 0.85))
	}
	var sumQuality, sumRows float64
	gaps := 0
	for _, m := range ok {
		sumQuality += float64(m.QualityScore)
		sumRows += float64(m.RowsSampled)
		if m.SchemaGap {
			gaps++
		}
	}
	meanQuality := sumQuality / float64(len(ok))
	gapPenalty := float64(gaps * 6)
	if gapPenalty > 24 {
		gapPenalty = 24
	}
	volumeBonus := 0.0
	if sumRows > 0 {
		// approx log10(rows+1)*3 capped at 8 — keep simple without math import churn
		r := sumRows + 1
		switch {
		case r >= 1000:
			volumeBonus = 8
		case r >= 100:
			volumeBonus = 6
		case r >= 10:
			volumeBonus = 4
		default:
			volumeBonus = 2
		}
	}
	measured := clampScoreInt(int(meanQuality + volumeBonus - gapPenalty + 0.5))
	return clampScoreInt(int(float64(categoryFloor)*0.35 + float64(measured)*0.65 + 0.5))
}

func filterMeasured(ms []OpenDataMeasurement) []OpenDataMeasurement {
	out := make([]OpenDataMeasurement, 0, len(ms))
	for _, m := range ms {
		if m.Error == "" && m.RowsSampled > 0 {
			out = append(out, m)
		}
	}
	return out
}

func clampScoreInt(v int) int {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}
