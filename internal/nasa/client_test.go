package nasa

import (
	"testing"
	"time"

	"github.com/sargisis/spacefetch/internal/models"
)

func TestEnrich(t *testing.T) {
	// Sample NeoObject with close approach data (no close_approach_date string, only epoch)
	neo := models.NeoObject{
		ID:                     "12345",
		Name:                   "Test Asteroid",
		IsPotentiallyHazardous: true,
		EstimatedDiameter: models.EstimatedDiameter{
			Meters: models.DiameterRange{
				Min: 100.0,
				Max: 200.0,
			},
		},
		CloseApproachData: []models.CloseApproach{
			{
				RelativeVelocity: models.Velocity{
					KmPerHour: "54321.123",
				},
				MissDistance: models.Distance{
					Kilometers: "987654.321",
				},
				EpochDate:    1719225600000, // 2024-06-24 10:40:00 UTC
				OrbitingBody: "Earth",
			},
		},
	}

	asteroid := Enrich(neo)

	if asteroid.ID != "12345" {
		t.Errorf("expected ID 12345, got %s", asteroid.ID)
	}
	if asteroid.Name != "Test Asteroid" {
		t.Errorf("expected Name 'Test Asteroid', got %s", asteroid.Name)
	}
	if !asteroid.IsHazardous {
		t.Errorf("expected IsHazardous to be true")
	}

	// Diameter: (100 + 200) / 2 = 150.0
	if asteroid.Metrics.DiameterMeters != 150.0 {
		t.Errorf("expected DiameterMeters 150.0, got %.1f", asteroid.Metrics.DiameterMeters)
	}

	// Velocity: 54321.123 -> rounded to 1 decimal place = 54321.1
	if asteroid.Metrics.VelocityKmH != 54321.1 {
		t.Errorf("expected VelocityKmH 54321.1, got %.1f", asteroid.Metrics.VelocityKmH)
	}

	// MissDistance: 987654.321 -> rounded to 1 decimal place = 987654.3
	if asteroid.Metrics.MissDistanceKm != 987654.3 {
		t.Errorf("expected MissDistanceKm 987654.3, got %.1f", asteroid.Metrics.MissDistanceKm)
	}

	// CloseApproachDate fallback: 1719225600000 ms -> 2024-06-24
	expectedDate := "2024-06-24"
	if asteroid.CloseApproachDate != expectedDate {
		t.Errorf("expected CloseApproachDate %s, got %s", expectedDate, asteroid.CloseApproachDate)
	}
}

func TestEnrichWithDirectDate(t *testing.T) {
	// Sample NeoObject with close_approach_date string directly provided
	neo := models.NeoObject{
		ID:   "99999",
		Name: "Direct Date Asteroid",
		CloseApproachData: []models.CloseApproach{
			{
				CloseApproachDate: "2026-06-25",
			},
		},
	}

	asteroid := Enrich(neo)
	if asteroid.CloseApproachDate != "2026-06-25" {
		t.Errorf("expected CloseApproachDate 2026-06-25, got %s", asteroid.CloseApproachDate)
	}
}

func TestCalculateEconomy(t *testing.T) {
	tests := []struct {
		name               string
		minDia             float64
		maxDia             float64
		expectedDifficulty string
		expectedValue      int64
		hasGold            bool
		hasPlatinum        bool
	}{
		{
			name:               "Small Asteroid (<100m)",
			minDia:             10,
			maxDia:             30,
			expectedDifficulty: "low",
			expectedValue:      int64(20 * 20 * 20 * 50), // 400000
			hasGold:            false,
			hasPlatinum:        false,
		},
		{
			name:               "Medium Asteroid (100m-500m)",
			minDia:             150,
			maxDia:             250,
			expectedDifficulty: "medium",
			expectedValue:      int64(200 * 200 * 200 * 300), // 2.4 Billion
			hasGold:            true,
			hasPlatinum:        false,
		},
		{
			name:               "Large Asteroid (>500m)",
			minDia:             500,
			maxDia:             700,
			expectedDifficulty: "high",
			expectedValue:      int64(600 * 600 * 600 * 1200), // 259.2 Billion
			hasGold:            false,
			hasPlatinum:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			neo := models.NeoObject{
				EstimatedDiameter: models.EstimatedDiameter{
					Meters: models.DiameterRange{
						Min: tt.minDia,
						Max: tt.maxDia,
					},
				},
			}

			economy := calculateEconomy(neo)

			if economy.MiningDifficulty != tt.expectedDifficulty {
				t.Errorf("expected difficulty %s, got %s", tt.expectedDifficulty, economy.MiningDifficulty)
			}

			if economy.EstimatedValueUSD != tt.expectedValue {
				t.Errorf("expected value %d, got %d", tt.expectedValue, economy.EstimatedValueUSD)
			}

			// check primary materials
			hasGold := false
			hasPlatinum := false
			for _, m := range economy.PrimaryMaterials {
				if m == "gold" {
					hasGold = true
				}
				if m == "platinum" {
					hasPlatinum = true
				}
			}

			if hasGold != tt.hasGold {
				t.Errorf("expected hasGold %t, got %t", tt.hasGold, hasGold)
			}
			if hasPlatinum != tt.hasPlatinum {
				t.Errorf("expected hasPlatinum %t, got %t", tt.hasPlatinum, hasPlatinum)
			}
		})
	}
}

func TestEnrichFallbackDate(t *testing.T) {
	// NeoObject without close approach data
	neo := models.NeoObject{
		ID:   "54321",
		Name: "Fallback Date Test",
	}

	asteroid := Enrich(neo)

	today := time.Now().UTC().Format("2006-01-02")
	if asteroid.CloseApproachDate != today {
		t.Errorf("expected fallback CloseApproachDate to be today %s, got %s", today, asteroid.CloseApproachDate)
	}
}
