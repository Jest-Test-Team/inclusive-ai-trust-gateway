// Package rest is the HTTP/JSON protocol adapter. Handlers translate wire
// payloads into CQRS commands/queries and map results back to response DTOs;
// no business logic lives here.
package rest

import (
	"encoding/json"
	"errors"
	"net/http"

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
}

func NewServer(bus *cqrs.Bus, apiKey string) *Server {
	return &Server{bus: bus, validate: validator.New(), apiKey: apiKey}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID, chimw.RealIP, chimw.Logger, chimw.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/v1", func(v1 chi.Router) {
		v1.Use(middleware.APIKey(s.apiKey))
		v1.Post("/assessments", s.createAssessment)
		v1.Get("/assessments", s.listAssessments)
		v1.Get("/assessments/{id}", s.getAssessment)
		v1.Get("/dashboard", s.dashboard)
		v1.Post("/adm/events", s.ingestADMEvent)
		v1.Get("/adm/events", s.listADMEvents)
	})

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
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "assessment failed"})
		return
	}
	writeJSON(w, http.StatusCreated, dto.FromAssessment(a))
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
	writeJSON(w, http.StatusOK, vm.BuildDashboard(list, len(list)))
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
