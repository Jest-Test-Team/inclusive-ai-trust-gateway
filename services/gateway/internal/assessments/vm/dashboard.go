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
	// Cumulative, all-time metrics for the quantifiable-benefits board.
	AdmEventsByType map[string]int `json:"admEventsByType"`
	AdmEventsTotal  int            `json:"admEventsTotal"`
}

// BuildDashboard shapes the landing view. total is the all-time assessment
// count (not the length of recent); admByType is the all-time safety-event
// count grouped by event type.
func BuildDashboard(recent []assessments.Assessment, total int, admByType map[string]int) DashboardVM {
	vm := DashboardVM{
		TotalAssessments: total,
		Recent:           make([]dto.AssessmentResponse, 0, len(recent)),
		AdmEventsByType:  admByType,
	}
	if vm.AdmEventsByType == nil {
		vm.AdmEventsByType = map[string]int{}
	}
	for _, n := range vm.AdmEventsByType {
		vm.AdmEventsTotal += n
	}
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
