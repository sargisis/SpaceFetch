package ai

import (
	"context"

	"github.com/sargisis/spacefetch/internal/models"
)

// Client is the interface for AI-powered asteroid description generation.
// Implementation will be swapped in once a provider is chosen.
type Client interface {
	GenerateSummaries(ctx context.Context, asteroid models.Asteroid, languages []string) (map[string]string, error)
	Close() error
}
