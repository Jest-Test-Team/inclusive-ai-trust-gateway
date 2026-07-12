package assessments

import (
	"context"
	"errors"
	"sync"
)

// ErrNotFound is returned for unknown assessment IDs.
var ErrNotFound = errors.New("assessment not found")

// Repository abstracts persistence. The ent/Postgres implementation lands
// with infra/database; MemoryRepository backs tests and DB-less demo mode.
type Repository interface {
	Create(ctx context.Context, a Assessment) error
	Get(ctx context.Context, id string) (Assessment, error)
	List(ctx context.Context, limit int) ([]Assessment, error)
}

type MemoryRepository struct {
	mu    sync.RWMutex
	items map[string]Assessment
	order []string
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{items: map[string]Assessment{}}
}

func (r *MemoryRepository) Create(_ context.Context, a Assessment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[a.ID] = a
	r.order = append(r.order, a.ID)
	return nil
}

func (r *MemoryRepository) Get(_ context.Context, id string) (Assessment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	a, ok := r.items[id]
	if !ok {
		return Assessment{}, ErrNotFound
	}
	return a, nil
}

func (r *MemoryRepository) List(_ context.Context, limit int) ([]Assessment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	n := len(r.order)
	if limit > 0 && limit < n {
		n = limit
	}
	out := make([]Assessment, 0, n)
	for i := len(r.order) - 1; i >= 0 && len(out) < n; i-- {
		out = append(out, r.items[r.order[i]])
	}
	return out, nil
}
