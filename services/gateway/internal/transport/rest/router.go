// Package rest is the HTTP/JSON protocol adapter. Handlers translate wire
// payloads into CQRS commands/queries and map results back to response DTOs;
// no business logic lives here.
package rest

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-playground/validator/v10"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/adm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/commands"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/dto"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/queries"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/assessments/vm"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/domain"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/cqrs"
	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/platform/middleware"
)

// defaultSafetySignals reflects the ADM control inventory used until live
// per-use-case control discovery is wired (mirrors packages/shared sample
// data so scores match the original dashboard).
var defaultSafetySignals = []erh.SafetySignal{
	{Control: "Prompt-injection trajectory monitoring", Status: "ready"},
	{Control: "Tool-call policy enforcement", Status: "ready"},
	{Control: "Session-bound containment", Status: "partial"},
	{Control: "Open-data provenance checks", Status: "partial"},
}

type Server struct {
	bus      *cqrs.Bus
	validate *validator.Validate
	apiKey   string
	erhURL   string
	erhPing  func(context.Context) error

	// Optional protocol surfaces mounted alongside REST; nil = not enabled.
	WS          http.Handler // /ws
	GraphQL     http.Handler // /graphql (API-key guarded)
	MCP         http.Handler // /mcp
	Commerce    chi.Router   // /ucp/v1 (API-key guarded)
	ConnectPath string       // Connect-RPC mount path (e.g. /iatg.v1.TrustService/)
	Connect     http.Handler
}

func NewServer(bus *cqrs.Bus, apiKey string) *Server {
	return &Server{bus: bus, validate: validator.New(), apiKey: apiKey}
}

// WithERHHealth attaches ERH connectivity reporting to /healthz.
func (s *Server) WithERHHealth(url string, ping func(context.Context) error) *Server {
	s.erhURL = url
	s.erhPing = ping
	return s
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID, chimw.RealIP, chimw.Logger, chimw.Recoverer)
	r.Use(middleware.CORS)

	r.Get("/healthz", s.healthz)
	r.Get("/openapi.json", s.openAPI)
	r.Get("/docs", s.swaggerUI)
	r.Get("/swagger", s.swaggerUI)

	r.Route("/v1", func(v1 chi.Router) {
		v1.Use(middleware.APIKey(s.apiKey))
		v1.Post("/assessments", s.createAssessment)
		v1.Post("/assessments/reassess-stale", s.reassessStale)
		v1.Post("/assessments/{id}/reassess", s.reassessAssessment)
		v1.Get("/assessments", s.listAssessments)
		v1.Get("/assessments/{id}", s.getAssessment)
		v1.Get("/dashboard", s.dashboard)
		v1.Post("/adm/events", s.ingestADMEvent)
		v1.Get("/adm/events", s.listADMEvents)
	})

	if s.WS != nil {
		r.Handle("/ws", s.WS) // key checked in-handler via ?api_key=
	}
	if s.GraphQL != nil {
		r.With(middleware.APIKey(s.apiKey)).Post("/graphql", s.GraphQL.ServeHTTP)
	}
	if s.MCP != nil {
		r.With(middleware.APIKey(s.apiKey)).Handle("/mcp", s.MCP)
	}
	if s.Commerce != nil {
		r.With(middleware.APIKey(s.apiKey)).Mount("/ucp/v1", s.Commerce)
	}
	if s.Connect != nil && s.ConnectPath != "" {
		// Connect handlers route on the full request path, so mount without
		// stripping the prefix (trim the trailing slash for chi's pattern).
		r.With(middleware.APIKey(s.apiKey)).Mount(strings.TrimSuffix(s.ConnectPath, "/"), s.Connect)
	}

	r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	})
	return r
}

func (s *Server) createAssessment(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateAssessmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if err := s.validate.Struct(req); err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	a, err := cqrs.Dispatch[commands.CreateAssessment, assessments.Assessment](
		r.Context(), s.bus,
		commands.CreateAssessment{UseCase: req.ToDomain(), SafetySignals: defaultSafetySignals},
	)
	if err != nil {
		slog.Error("create assessment failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "assessment failed"})
		return
	}
	writeJSON(w, http.StatusCreated, dto.FromAssessment(a))
}

func (s *Server) reassessAssessment(w http.ResponseWriter, r *http.Request) {
	a, err := cqrs.Dispatch[commands.ReassessAssessment, assessments.Assessment](
		r.Context(), s.bus,
		commands.ReassessAssessment{ID: chi.URLParam(r, "id"), SafetySignals: defaultSafetySignals},
	)
	switch {
	case errors.Is(err, assessments.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	case err != nil:
		slog.Error("reassess assessment failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "reassess failed"})
	default:
		writeJSON(w, http.StatusOK, dto.FromAssessment(a))
	}
}

func (s *Server) reassessStale(w http.ResponseWriter, r *http.Request) {
	result, err := cqrs.Dispatch[commands.ReassessStale, commands.ReassessStaleResult](
		r.Context(), s.bus,
		commands.ReassessStale{Limit: 200, SafetySignals: defaultSafetySignals},
	)
	if err != nil {
		slog.Error("reassess stale assessments failed", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "reassess failed"})
		return
	}
	items := make([]dto.AssessmentResponse, 0, len(result.Items))
	for _, a := range result.Items {
		items = append(items, dto.FromAssessment(a))
	}
	writeJSON(w, http.StatusOK, map[string]any{"updated": result.Updated, "items": items})
}

func (s *Server) healthz(w http.ResponseWriter, r *http.Request) {
	body := map[string]any{
		"status": "ok",
		"erh": map[string]any{
			"configured": s.erhURL != "",
			"reachable":  false,
			"evaluator":  "deterministic-fallback",
		},
	}
	if s.erhURL != "" {
		body["erh"].(map[string]any)["url"] = s.erhURL
		body["erh"].(map[string]any)["evaluator"] = "resilient"
		if s.erhPing != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			defer cancel()
			if err := s.erhPing(ctx); err == nil {
				body["erh"].(map[string]any)["reachable"] = true
				body["erh"].(map[string]any)["evaluator"] = "erh-engine"
			} else {
				body["erh"].(map[string]any)["error"] = err.Error()
			}
		}
	}
	writeJSON(w, http.StatusOK, body)
}

func (s *Server) getAssessment(w http.ResponseWriter, r *http.Request) {
	a, err := cqrs.Dispatch[queries.GetAssessment, assessments.Assessment](
		r.Context(), s.bus, queries.GetAssessment{ID: chi.URLParam(r, "id")},
	)
	switch {
	case errors.Is(err, assessments.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	case err != nil:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "lookup failed"})
	default:
		writeJSON(w, http.StatusOK, dto.FromAssessment(a))
	}
}

func (s *Server) listAssessments(w http.ResponseWriter, r *http.Request) {
	list, err := cqrs.Dispatch[queries.ListAssessments, []assessments.Assessment](
		r.Context(), s.bus, queries.ListAssessments{Limit: 50},
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list failed"})
		return
	}
	out := make([]dto.AssessmentResponse, 0, len(list))
	for _, a := range list {
		out = append(out, dto.FromAssessment(a))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

func (s *Server) dashboard(w http.ResponseWriter, r *http.Request) {
	list, err := cqrs.Dispatch[queries.ListAssessments, []assessments.Assessment](
		r.Context(), s.bus, queries.ListAssessments{Limit: 10},
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "dashboard failed"})
		return
	}
	// All-time cumulative metrics (not limited to the recent page). Degrade
	// gracefully to page-derived values if a count query fails.
	total, err := cqrs.Dispatch[queries.CountAssessments, int](r.Context(), s.bus, queries.CountAssessments{})
	if err != nil {
		total = len(list)
	}
	admByType, err := cqrs.Dispatch[adm.CountEventsByType, map[string]int](r.Context(), s.bus, adm.CountEventsByType{})
	if err != nil {
		admByType = map[string]int{}
	}
	writeJSON(w, http.StatusOK, vm.BuildDashboard(list, total, admByType))
}

type ingestEventRequest struct {
	EventType string          `json:"eventType" validate:"required,oneof=prompt_injection tool_policy containment provenance"`
	Severity  string          `json:"severity" validate:"required"`
	Detail    json.RawMessage `json:"detail" validate:"required"`
	SessionID string          `json:"sessionId"`
}

func (s *Server) ingestADMEvent(w http.ResponseWriter, r *http.Request) {
	var req ingestEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if err := s.validate.Struct(req); err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	severity, err := domain.ParseSeverity(req.Severity)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	e, err := cqrs.Dispatch[adm.IngestEvent, adm.SafetyEvent](
		r.Context(), s.bus,
		adm.IngestEvent{EventType: req.EventType, Severity: severity, Detail: req.Detail, SessionID: req.SessionID},
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "ingest failed"})
		return
	}
	writeJSON(w, http.StatusAccepted, e)
}

func (s *Server) listADMEvents(w http.ResponseWriter, r *http.Request) {
	list, err := cqrs.Dispatch[adm.ListEvents, []adm.SafetyEvent](
		r.Context(), s.bus, adm.ListEvents{Limit: 100},
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": list})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
