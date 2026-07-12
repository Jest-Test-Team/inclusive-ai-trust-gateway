// Package queries holds the read-side CQRS objects of the assessments
// module. Every read surface (REST, GraphQL, Connect-RPC, MCP) dispatches
// these same query objects.
package queries

import (
	"context"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
)

// GetAssessment fetches one assessment by ID.
type GetAssessment struct{ ID string }

type GetAssessmentHandler struct{ Repo assessments.Repository }

func (h GetAssessmentHandler) Handle(ctx context.Context, q GetAssessment) (assessments.Assessment, error) {
	return h.Repo.Get(ctx, q.ID)
}

// ListAssessments returns the newest assessments first.
type ListAssessments struct{ Limit int }

type ListAssessmentsHandler struct{ Repo assessments.Repository }

func (h ListAssessmentsHandler) Handle(ctx context.Context, q ListAssessments) ([]assessments.Assessment, error) {
	return h.Repo.List(ctx, q.Limit)
}
