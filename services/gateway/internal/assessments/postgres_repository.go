package assessments

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Jest-Test-Team/inclusive-ai-trust-gateway/services/gateway/internal/erh"
)

// PostgresRepository persists assessments to the infra/database schema
// (use_cases + personas + open_data_sources + assessments).
type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) Create(ctx context.Context, a Assessment) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	useCaseID := uuid.NewString()
	_, err = tx.Exec(ctx, `
		INSERT INTO use_cases (id, name, domain, description, sdg_tags, target_users, ai_capabilities, safeguards, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		useCaseID, a.UseCase.Name, a.UseCase.Domain, a.UseCase.Summary,
		a.UseCase.SDGs, a.UseCase.TargetUsers, a.UseCase.AICapabilities, a.UseCase.Safeguards, a.CreatedAt,
	)
	if err != nil {
		return err
	}

	for _, p := range a.UseCase.Personas {
		if _, err := tx.Exec(ctx, `
			INSERT INTO personas (use_case_id, label, age_group, region, needs, barriers)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			useCaseID, p.Label, p.AgeGroup, p.Region, p.Needs, p.Barriers,
		); err != nil {
			return err
		}
	}
	for _, source := range a.UseCase.OpenDataSources {
		if _, err := tx.Exec(ctx, `
			INSERT INTO open_data_sources (use_case_id, name) VALUES ($1, $2)`,
			useCaseID, source,
		); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO assessments (id, use_case_id, inclusion_score, fairness_risk, fairness_risk_label,
			open_data_readiness, agent_safety_readiness, evaluator, summary, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		a.ID, useCaseID, a.Result.InclusionScore, a.Result.FairnessRiskScore, a.Result.FairnessRiskLabel,
		a.Result.OpenDataReadiness, a.Result.AgentSafetyReadiness, a.Result.Evaluator, a.UseCase.Summary, a.CreatedAt,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PostgresRepository) Get(ctx context.Context, id string) (Assessment, error) {
	rows, err := r.pool.Query(ctx, assessmentQuery+` WHERE a.id = $1`, id)
	if err != nil {
		return Assessment{}, err
	}
	list, err := scanAssessments(ctx, r.pool, rows)
	if err != nil {
		return Assessment{}, err
	}
	if len(list) == 0 {
		return Assessment{}, ErrNotFound
	}
	return list[0], nil
}

func (r *PostgresRepository) List(ctx context.Context, limit int) ([]Assessment, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.pool.Query(ctx, assessmentQuery+` ORDER BY a.created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	return scanAssessments(ctx, r.pool, rows)
}

const assessmentQuery = `
	SELECT a.id, a.inclusion_score, a.fairness_risk, a.fairness_risk_label,
	       a.open_data_readiness, a.agent_safety_readiness, a.evaluator, a.created_at,
	       u.id, u.name, u.domain, u.description, u.sdg_tags, u.target_users, u.ai_capabilities, u.safeguards
	FROM assessments a
	JOIN use_cases u ON u.id = a.use_case_id`

func scanAssessments(ctx context.Context, pool *pgxpool.Pool, rows pgx.Rows) ([]Assessment, error) {
	defer rows.Close()
	var list []Assessment
	useCaseIDs := map[string]int{} // use_case id -> index in list
	for rows.Next() {
		var a Assessment
		var useCaseID string
		var createdAt time.Time
		if err := rows.Scan(
			&a.ID, &a.Result.InclusionScore, &a.Result.FairnessRiskScore, &a.Result.FairnessRiskLabel,
			&a.Result.OpenDataReadiness, &a.Result.AgentSafetyReadiness, &a.Result.Evaluator, &createdAt,
			&useCaseID, &a.UseCase.Name, &a.UseCase.Domain, &a.UseCase.Summary,
			&a.UseCase.SDGs, &a.UseCase.TargetUsers, &a.UseCase.AICapabilities, &a.UseCase.Safeguards,
		); err != nil {
			return nil, err
		}
		a.CreatedAt = createdAt
		useCaseIDs[useCaseID] = len(list)
		list = append(list, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return list, nil
	}

	// Attach personas and open-data sources for the fetched use cases.
	ids := make([]string, 0, len(useCaseIDs))
	for id := range useCaseIDs {
		ids = append(ids, id)
	}
	personaRows, err := pool.Query(ctx, `
		SELECT use_case_id, label, age_group, region, needs, barriers
		FROM personas WHERE use_case_id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer personaRows.Close()
	for personaRows.Next() {
		var useCaseID string
		var p erh.Persona
		if err := personaRows.Scan(&useCaseID, &p.Label, &p.AgeGroup, &p.Region, &p.Needs, &p.Barriers); err != nil {
			return nil, err
		}
		if idx, ok := useCaseIDs[useCaseID]; ok {
			list[idx].UseCase.Personas = append(list[idx].UseCase.Personas, p)
		}
	}
	if err := personaRows.Err(); err != nil {
		return nil, err
	}

	sourceRows, err := pool.Query(ctx, `
		SELECT use_case_id, name FROM open_data_sources WHERE use_case_id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer sourceRows.Close()
	for sourceRows.Next() {
		var useCaseID, name string
		if err := sourceRows.Scan(&useCaseID, &name); err != nil {
			return nil, err
		}
		if idx, ok := useCaseIDs[useCaseID]; ok {
			list[idx].UseCase.OpenDataSources = append(list[idx].UseCase.OpenDataSources, name)
		}
	}
	return list, sourceRows.Err()
}

var _ Repository = (*PostgresRepository)(nil)

// ErrNoDatabase distinguishes wiring errors from lookup misses.
var ErrNoDatabase = errors.New("postgres repository: nil pool")
