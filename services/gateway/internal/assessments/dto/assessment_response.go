package dto

import (
	"time"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
)

// AssessmentResponse is the wire shape for a stored assessment. All four
// score fields are numeric 0-100 (the Robot contract suite asserts this);
// fairnessRiskLabel carries the human-readable band.
type AssessmentResponse struct {
	ID                   string    `json:"id"`
	Name                 string    `json:"name"`
	Domain               string    `json:"domain"`
	InclusionScore       int       `json:"inclusionScore"`
	FairnessRisk         int       `json:"fairnessRisk"`
	FairnessRiskLabel    string    `json:"fairnessRiskLabel"`
	OpenDataReadiness    int       `json:"openDataReadiness"`
	AgentSafetyReadiness int       `json:"agentSafetyReadiness"`
	Evaluator            string    `json:"evaluator"`
	CreatedAt            time.Time `json:"createdAt"`
}

func FromAssessment(a assessments.Assessment) AssessmentResponse {
	return AssessmentResponse{
		ID:                   a.ID,
		Name:                 a.UseCase.Name,
		Domain:               a.UseCase.Domain,
		InclusionScore:       a.Result.InclusionScore,
		FairnessRisk:         a.Result.FairnessRiskScore,
		FairnessRiskLabel:    a.Result.FairnessRiskLabel,
		OpenDataReadiness:    a.Result.OpenDataReadiness,
		AgentSafetyReadiness: a.Result.AgentSafetyReadiness,
		Evaluator:            a.Result.Evaluator,
		CreatedAt:            a.CreatedAt,
	}
}
