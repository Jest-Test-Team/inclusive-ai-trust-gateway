// Package connectrpc is the Connect-RPC protocol adapter (the type-safe
// schema-first replacement for tRPC): the same proto generates this Go
// server and the TypeScript client used by apps/web.
package connectrpc

import (
	"context"
	"net/http"
	"time"

	"connectrpc.com/connect"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/commands"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/queries"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
	iatgv1 "github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/connectrpc/gen/iatg/v1"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/transport/connectrpc/gen/iatg/v1/iatgv1connect"
)

type service struct{ bus *cqrs.Bus }

// NewHandler returns the mount path and handler for the TrustService.
func NewHandler(bus *cqrs.Bus) (string, http.Handler) {
	return iatgv1connect.NewTrustServiceHandler(service{bus: bus})
}

func (s service) EvaluateService(ctx context.Context, req *connect.Request[iatgv1.EvaluateServiceRequest]) (*connect.Response[iatgv1.Assessment], error) {
	m := req.Msg
	personas := make([]erh.Persona, 0, len(m.Personas))
	for _, p := range m.Personas {
		personas = append(personas, erh.Persona{
			Label: p.Label, AgeGroup: p.AgeGroup, Region: p.Region,
			Needs: p.Needs, Barriers: p.Barriers,
		})
	}
	a, err := cqrs.Dispatch[commands.CreateAssessment, assessments.Assessment](ctx, s.bus, commands.CreateAssessment{
		UseCase: erh.UseCase{
			Name: m.Name, Domain: m.Domain, Summary: m.Description,
			TargetUsers: m.TargetUsers, SDGs: m.Sdgs,
			OpenDataSources: m.OpenDataSources, AICapabilities: m.AiCapabilities,
			Safeguards: m.Safeguards, Personas: personas,
		},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(toProto(a)), nil
}

func (s service) GetAssessment(ctx context.Context, req *connect.Request[iatgv1.GetAssessmentRequest]) (*connect.Response[iatgv1.Assessment], error) {
	a, err := cqrs.Dispatch[queries.GetAssessment, assessments.Assessment](ctx, s.bus, queries.GetAssessment{ID: req.Msg.Id})
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	return connect.NewResponse(toProto(a)), nil
}

func (s service) ListAssessments(ctx context.Context, req *connect.Request[iatgv1.ListAssessmentsRequest]) (*connect.Response[iatgv1.ListAssessmentsResponse], error) {
	limit := int(req.Msg.Limit)
	if limit <= 0 {
		limit = 20
	}
	list, err := cqrs.Dispatch[queries.ListAssessments, []assessments.Assessment](ctx, s.bus, queries.ListAssessments{Limit: limit})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	resp := &iatgv1.ListAssessmentsResponse{}
	for _, a := range list {
		resp.Items = append(resp.Items, toProto(a))
	}
	return connect.NewResponse(resp), nil
}

func (s service) ListSafetyEvents(ctx context.Context, req *connect.Request[iatgv1.ListSafetyEventsRequest]) (*connect.Response[iatgv1.ListSafetyEventsResponse], error) {
	limit := int(req.Msg.Limit)
	if limit <= 0 {
		limit = 20
	}
	list, err := cqrs.Dispatch[adm.ListEvents, []adm.SafetyEvent](ctx, s.bus, adm.ListEvents{Limit: limit})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	resp := &iatgv1.ListSafetyEventsResponse{}
	for _, e := range list {
		resp.Items = append(resp.Items, &iatgv1.SafetyEvent{
			Id: e.ID, EventType: e.EventType, Severity: string(e.Severity),
			SessionId: e.SessionID, ReceivedAt: e.ReceivedAt.Format(time.RFC3339),
		})
	}
	return connect.NewResponse(resp), nil
}

func toProto(a assessments.Assessment) *iatgv1.Assessment {
	return &iatgv1.Assessment{
		Id:                   a.ID,
		Name:                 a.UseCase.Name,
		Domain:               a.UseCase.Domain,
		InclusionScore:       int32(a.Result.InclusionScore),
		FairnessRisk:         int32(a.Result.FairnessRiskScore),
		FairnessRiskLabel:    a.Result.FairnessRiskLabel,
		OpenDataReadiness:    int32(a.Result.OpenDataReadiness),
		AgentSafetyReadiness: int32(a.Result.AgentSafetyReadiness),
		Evaluator:            a.Result.Evaluator,
		CreatedAt:            a.CreatedAt.Format(time.RFC3339),
	}
}
