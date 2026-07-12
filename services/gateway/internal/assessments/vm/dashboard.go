// Package vm holds ViewModels: read projections shaped for a specific UI
// view rather than for the domain. The dashboard VM powers the web/mobile
// overview screen in one request.
package vm

import (
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/dto"
)

// DashboardVM is the single-fetch payload for the trust dashboard's
// landing view.
type DashboardVM struct {
	TotalAssessments int                      `json:"totalAssessments"`
	AverageInclusion int                      `json:"averageInclusion"`
	HighRiskCount    int                      `json:"highRiskCount"`
	Recent           []dto.AssessmentResponse `json:"recent"`
}

func BuildDashboard(recent []assessments.Assessment, total int) DashboardVM {
	vm := DashboardVM{TotalAssessments: total, Recent: make([]dto.AssessmentResponse, 0, len(recent))}
	sum := 0
	for _, a := range recent {
		vm.Recent = append(vm.Recent, dto.FromAssessment(a))
		sum += a.Result.InclusionScore
		if a.Result.FairnessRiskLabel == "High" {
			vm.HighRiskCount++
		}
	}
	if len(recent) > 0 {
		vm.AverageInclusion = sum / len(recent)
	}
	return vm
}
