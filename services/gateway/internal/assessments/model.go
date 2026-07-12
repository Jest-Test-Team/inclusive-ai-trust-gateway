// Package assessments owns the trust-assessment aggregate: creation
// (command), retrieval (queries), persistence, and its DTO/VM projections.
package assessments

import (
	"time"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
)

// Assessment is the domain aggregate persisted per evaluated use case.
type Assessment struct {
	ID        string
	UseCase   erh.UseCase
	Result    erh.Result
	CreatedAt time.Time
}
