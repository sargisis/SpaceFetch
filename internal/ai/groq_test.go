package ai

import (
	"context"
	"strings"
	"testing"

	"github.com/sargisis/spacefetch/internal/models"
)

func TestNewClientFallback(t *testing.T) {
	keys := []string{"", "demo", "mock"}

	for _, key := range keys {
		cli, err := NewClient(key)
		if err != nil {
			t.Fatalf("unexpected error creating client with key %q: %v", key, err)
		}

		_, ok := cli.(*fallbackClient)
		if !ok {
			t.Errorf("expected client with key %q to be fallbackClient, got %T", key, cli)
		}
	}
}

func TestNewClientGroq(t *testing.T) {
	cli, err := NewClient("gsk_some_dummy_key_123")
	if err != nil {
		t.Fatalf("unexpected error creating groq client: %v", err)
	}

	_, ok := cli.(*groqClient)
	if !ok {
		t.Errorf("expected client with valid key to be groqClient, got %T", cli)
	}
}

func TestFallbackClientGenerateSummaries(t *testing.T) {
	cli, err := NewClient("demo")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	asteroid := models.Asteroid{
		Name: "Apophis",
		Metrics: models.Metrics{
			DiameterMeters: 370.0,
			VelocityKmH:    110000.0,
		},
		MiningEconomy: models.MiningEconomy{
			EstimatedValueUSD: 400000000,
		},
	}

	summaries, err := cli.GenerateSummaries(context.Background(), asteroid, []string{"en", "ru"})
	if err != nil {
		t.Fatalf("unexpected error generating summaries: %v", err)
	}

	if len(summaries) != 2 {
		t.Errorf("expected 2 translations, got %d", len(summaries))
	}

	en, exists := summaries["en"]
	if !exists {
		t.Error("expected 'en' summary to exist")
	}
	if !strings.Contains(en, "Apophis") || !strings.Contains(en, "370.0") {
		t.Errorf("expected 'en' summary to contain name and diameter: %s", en)
	}

	ru, exists := summaries["ru"]
	if !exists {
		t.Error("expected 'ru' summary to exist")
	}
	if !strings.Contains(ru, "Apophis") || !strings.Contains(ru, "370.0") {
		t.Errorf("expected 'ru' summary to contain name and diameter: %s", ru)
	}
}
