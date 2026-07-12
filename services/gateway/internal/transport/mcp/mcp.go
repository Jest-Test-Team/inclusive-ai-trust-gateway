// Package mcp exposes the trust gateway as a Model Context Protocol server,
// so any AI agent (Claude, IDE assistants, autonomous agents) can ask
// whether a public AI service is safe and inclusive before relying on it.
// Served over streamable HTTP at /mcp.
package mcp

import (
	"context"
	"net/http"

	sdk "github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/commands"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/dto"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/queries"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
)

type getAssessmentInput struct {
	ID string `json:"id" jsonschema:"assessment ID returned by evaluate_service or list tools"`
}

type evaluateServiceInput struct {
	Name            string   `json:"name" jsonschema:"name of the public AI service"`
	Domain          string   `json:"domain" jsonschema:"service domain, e.g. Care Services"`
	Description     string   `json:"description,omitempty"`
	OpenDataSources []string `json:"openDataSources,omitempty"`
	Safeguards      []string `json:"safeguards,omitempty"`
	Barriers        []string `json:"barriers,omitempty" jsonschema:"known access barriers of affected users"`
}

type listEventsInput struct {
	Limit int `json:"limit,omitempty" jsonschema:"maximum number of events (default 20)"`
}

// Tool outputs must be JSON objects, so list results are wrapped.
type assessmentListOutput struct {
	Items []dto.AssessmentResponse `json:"items"`
}

type safetyEventListOutput struct {
	Items []adm.SafetyEvent `json:"items"`
}

// NewHTTPHandler builds the MCP server with its four trust tools and wraps
// it in the streamable HTTP transport.
func NewHTTPHandler(bus *cqrs.Bus) http.Handler {
	server := sdk.NewServer(&sdk.Implementation{
		Name:    "inclusive-ai-trust-gateway",
		Version: "0.2.0",
	}, nil)

	sdk.AddTool(server, &sdk.Tool{
		Name:        "get_assessment",
		Description: "Fetch a stored trust assessment (inclusion, fairness, open-data, agent-safety scores) by ID.",
	}, func(ctx context.Context, _ *sdk.CallToolRequest, in getAssessmentInput) (*sdk.CallToolResult, dto.AssessmentResponse, error) {
		a, err := cqrs.Dispatch[queries.GetAssessment, assessments.Assessment](ctx, bus, queries.GetAssessment{ID: in.ID})
		if err != nil {
			return nil, dto.AssessmentResponse{}, err
		}
		return nil, dto.FromAssessment(a), nil
	})

	sdk.AddTool(server, &sdk.Tool{
		Name:        "evaluate_service",
		Description: "Evaluate a public AI service for inclusion and fairness trust; returns scores and stores the assessment.",
	}, func(ctx context.Context, _ *sdk.CallToolRequest, in evaluateServiceInput) (*sdk.CallToolResult, dto.AssessmentResponse, error) {
		uc := erh.UseCase{
			Name:            in.Name,
			Domain:          in.Domain,
			Summary:         in.Description,
			OpenDataSources: in.OpenDataSources,
			Safeguards:      in.Safeguards,
		}
		if len(in.Barriers) > 0 {
			uc.Personas = []erh.Persona{{Label: "affected users", Barriers: in.Barriers}}
		}
		a, err := cqrs.Dispatch[commands.CreateAssessment, assessments.Assessment](ctx, bus, commands.CreateAssessment{UseCase: uc})
		if err != nil {
			return nil, dto.AssessmentResponse{}, err
		}
		return nil, dto.FromAssessment(a), nil
	})

	sdk.AddTool(server, &sdk.Tool{
		Name:        "list_assessments",
		Description: "List recent trust assessments, newest first.",
	}, func(ctx context.Context, _ *sdk.CallToolRequest, in listEventsInput) (*sdk.CallToolResult, assessmentListOutput, error) {
		limit := in.Limit
		if limit <= 0 {
			limit = 20
		}
		list, err := cqrs.Dispatch[queries.ListAssessments, []assessments.Assessment](ctx, bus, queries.ListAssessments{Limit: limit})
		if err != nil {
			return nil, assessmentListOutput{}, err
		}
		out := assessmentListOutput{Items: make([]dto.AssessmentResponse, 0, len(list))}
		for _, a := range list {
			out.Items = append(out.Items, dto.FromAssessment(a))
		}
		return nil, out, nil
	})

	sdk.AddTool(server, &sdk.Tool{
		Name:        "list_safety_events",
		Description: "List recent ADM agent-safety events (prompt injection, tool policy, containment).",
	}, func(ctx context.Context, _ *sdk.CallToolRequest, in listEventsInput) (*sdk.CallToolResult, safetyEventListOutput, error) {
		limit := in.Limit
		if limit <= 0 {
			limit = 20
		}
		list, err := cqrs.Dispatch[adm.ListEvents, []adm.SafetyEvent](ctx, bus, adm.ListEvents{Limit: limit})
		if err != nil {
			return nil, safetyEventListOutput{}, err
		}
		return nil, safetyEventListOutput{Items: list}, nil
	})

	return sdk.NewStreamableHTTPHandler(func(*http.Request) *sdk.Server { return server }, nil)
}
