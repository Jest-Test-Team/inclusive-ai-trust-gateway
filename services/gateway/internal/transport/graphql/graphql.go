// Package graphql is the GraphQL protocol adapter: a read-model projection
// of the same CQRS queries used by REST (assessments, safety events,
// dashboard). Mutations stay on REST/Connect-RPC by design — GraphQL here
// serves partners and analysts.
package graphql

import (
	"encoding/json"
	"net/http"

	gql "github.com/graphql-go/graphql"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/dto"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/queries"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
)

func NewHandler(bus *cqrs.Bus) (http.Handler, error) {
	assessmentType := gql.NewObject(gql.ObjectConfig{
		Name: "Assessment",
		Fields: gql.Fields{
			"id":                   &gql.Field{Type: gql.String},
			"name":                 &gql.Field{Type: gql.String},
			"domain":               &gql.Field{Type: gql.String},
			"inclusionScore":       &gql.Field{Type: gql.Int},
			"fairnessRisk":         &gql.Field{Type: gql.Int},
			"fairnessRiskLabel":    &gql.Field{Type: gql.String},
			"openDataReadiness":    &gql.Field{Type: gql.Int},
			"agentSafetyReadiness": &gql.Field{Type: gql.Int},
			"evaluator":            &gql.Field{Type: gql.String},
		},
	})

	safetyEventType := gql.NewObject(gql.ObjectConfig{
		Name: "SafetyEvent",
		Fields: gql.Fields{
			"id":        &gql.Field{Type: gql.String},
			"eventType": &gql.Field{Type: gql.String},
			"severity":  &gql.Field{Type: gql.String},
			"sessionId": &gql.Field{Type: gql.String},
		},
	})

	limitArg := gql.FieldConfigArgument{
		"limit": &gql.ArgumentConfig{Type: gql.Int, DefaultValue: 20},
	}

	root := gql.NewObject(gql.ObjectConfig{
		Name: "Query",
		Fields: gql.Fields{
			"assessment": &gql.Field{
				Type: assessmentType,
				Args: gql.FieldConfigArgument{
					"id": &gql.ArgumentConfig{Type: gql.NewNonNull(gql.String)},
				},
				Resolve: func(p gql.ResolveParams) (any, error) {
					a, err := cqrs.Dispatch[queries.GetAssessment, assessments.Assessment](
						p.Context, bus, queries.GetAssessment{ID: p.Args["id"].(string)},
					)
					if err != nil {
						return nil, err
					}
					return toMap(dto.FromAssessment(a)), nil
				},
			},
			"assessments": &gql.Field{
				Type: gql.NewList(assessmentType),
				Args: limitArg,
				Resolve: func(p gql.ResolveParams) (any, error) {
					list, err := cqrs.Dispatch[queries.ListAssessments, []assessments.Assessment](
						p.Context, bus, queries.ListAssessments{Limit: p.Args["limit"].(int)},
					)
					if err != nil {
						return nil, err
					}
					out := make([]map[string]any, 0, len(list))
					for _, a := range list {
						out = append(out, toMap(dto.FromAssessment(a)))
					}
					return out, nil
				},
			},
			"safetyEvents": &gql.Field{
				Type: gql.NewList(safetyEventType),
				Args: limitArg,
				Resolve: func(p gql.ResolveParams) (any, error) {
					list, err := cqrs.Dispatch[adm.ListEvents, []adm.SafetyEvent](
						p.Context, bus, adm.ListEvents{Limit: p.Args["limit"].(int)},
					)
					if err != nil {
						return nil, err
					}
					out := make([]map[string]any, 0, len(list))
					for _, e := range list {
						out = append(out, map[string]any{
							"id": e.ID, "eventType": e.EventType,
							"severity": string(e.Severity), "sessionId": e.SessionID,
						})
					}
					return out, nil
				},
			},
		},
	})

	schema, err := gql.NewSchema(gql.SchemaConfig{Query: root})
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Query     string         `json:"query"`
			Variables map[string]any `json:"variables"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}
		result := gql.Do(gql.Params{
			Schema:         schema,
			RequestString:  body.Query,
			VariableValues: body.Variables,
			Context:        r.Context(),
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	}), nil
}

// toMap converts a response DTO to the generic map the resolver returns.
func toMap(v any) map[string]any {
	raw, _ := json.Marshal(v)
	var m map[string]any
	_ = json.Unmarshal(raw, &m)
	return m
}
