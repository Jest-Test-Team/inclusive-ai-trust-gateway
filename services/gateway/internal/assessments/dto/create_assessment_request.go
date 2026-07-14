// Package dto defines the request/response payloads for the assessments
// module. Request DTOs carry validator tags; response DTOs are mapped
// explicitly from domain models — entities never leak to the wire.
package dto

import (
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
)

type PersonaPayload struct {
	Label    string   `json:"label" validate:"required,max=200"`
	AgeGroup string   `json:"ageGroup" validate:"max=50"`
	Region   string   `json:"region" validate:"max=100"`
	Needs    []string `json:"needs" validate:"dive,max=200"`
	Barriers []string `json:"barriers" validate:"dive,max=200"`
}

type UseCasePayload struct {
	Name            string           `json:"name" validate:"required,max=200"`
	Domain          string           `json:"domain" validate:"required,max=100"`
	Description     string           `json:"description" validate:"max=2000"`
	TargetUsers     []string         `json:"targetUsers" validate:"dive,max=200"`
	SDGs            []string         `json:"sdgs" validate:"dive,max=20"`
	OpenDataSources []string         `json:"openDataSources" validate:"dive,max=300"`
	AICapabilities  []string         `json:"aiCapabilities" validate:"dive,max=300"`
	Safeguards      []string         `json:"safeguards" validate:"dive,max=300"`
	Personas        []PersonaPayload `json:"personas" validate:"dive"`
}

// CreateAssessmentRequest is the POST /v1/assessments form payload.
type CreateAssessmentRequest struct {
	UseCase              UseCasePayload            `json:"useCase" validate:"required"`
	OpenDataMeasurements []erh.OpenDataMeasurement `json:"openDataMeasurements,omitempty"`
}

// ToDomain maps the wire payload to the evaluator's use-case model.
func (r CreateAssessmentRequest) ToDomain() erh.UseCase {
	personas := make([]erh.Persona, 0, len(r.UseCase.Personas))
	for _, p := range r.UseCase.Personas {
		personas = append(personas, erh.Persona{
			Label:    p.Label,
			AgeGroup: p.AgeGroup,
			Region:   p.Region,
			Needs:    p.Needs,
			Barriers: p.Barriers,
		})
	}
	return erh.UseCase{
		Name:                 r.UseCase.Name,
		Domain:               r.UseCase.Domain,
		Summary:              r.UseCase.Description,
		TargetUsers:          r.UseCase.TargetUsers,
		SDGs:                 r.UseCase.SDGs,
		OpenDataSources:      r.UseCase.OpenDataSources,
		AICapabilities:       r.UseCase.AICapabilities,
		Safeguards:           r.UseCase.Safeguards,
		Personas:             personas,
		OpenDataMeasurements: r.OpenDataMeasurements,
	}
}
