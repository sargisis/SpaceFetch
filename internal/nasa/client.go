package nasa

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/sargisis/spacefetch/internal/models"
)

const neoWsURL = "https://api.nasa.gov/neo/rest/v1/feed"

type Client struct {
	apiKey  string
	httpCli *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpCli: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) FetchToday() ([]models.NeoObject, error) {
	now := time.Now().UTC()
	start := now.Format("2006-01-02")
	end := start

	u := fmt.Sprintf("%s?start_date=%s&end_date=%s&api_key=%s", neoWsURL, start, end, c.apiKey)
	resp, err := c.httpCli.Get(u)
	if err != nil {
		return nil, fmt.Errorf("nasa request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nasa returned status %d", resp.StatusCode)
	}

	var neoResp models.NeoWsResponse
	if err := json.NewDecoder(resp.Body).Decode(&neoResp); err != nil {
		return nil, fmt.Errorf("nasa decode failed: %w", err)
	}

	return neoResp.NearEarthObjects[start], nil
}

func Enrich(neo models.NeoObject) models.Asteroid {
	diameter := (neo.EstimatedDiameter.Meters.Min + neo.EstimatedDiameter.Meters.Max) / 2.0

	var velocity, missDist float64
	var closeApproachDate string
	if len(neo.CloseApproachData) > 0 {
		ca := neo.CloseApproachData[0]
		if v, err := strconv.ParseFloat(ca.RelativeVelocity.KmPerHour, 64); err == nil {
			velocity = v
		}
		if d, err := strconv.ParseFloat(ca.MissDistance.Kilometers, 64); err == nil {
			missDist = d
		}
		if ca.CloseApproachDate != "" {
			closeApproachDate = ca.CloseApproachDate
		} else {
			closeApproachDate = time.UnixMilli(ca.EpochDate).UTC().Format("2006-01-02")
		}
	} else {
		closeApproachDate = time.Now().UTC().Format("2006-01-02")
	}

	return models.Asteroid{
		ID:          neo.ID,
		Name:        neo.Name,
		IsHazardous: neo.IsPotentiallyHazardous,
		Metrics: models.Metrics{
			DiameterMeters: math.Round(diameter*10) / 10,
			VelocityKmH:    math.Round(velocity*10) / 10,
			MissDistanceKm: math.Round(missDist*10) / 10,
		},
		MiningEconomy:     calculateEconomy(neo),
		UpdatedAt:         time.Now().UTC(),
		CloseApproachDate: closeApproachDate,
	}
}

func calculateEconomy(neo models.NeoObject) models.MiningEconomy {
	diameter := (neo.EstimatedDiameter.Meters.Min + neo.EstimatedDiameter.Meters.Max) / 2.0

	materials := []string{"nickel", "iron"}
	difficulty := "low"
	var value int64

	switch {
	case diameter > 500:
		materials = append(materials, "platinum", "cobalt")
		difficulty = "high"
		value = int64(diameter * diameter * diameter * 1200)
	case diameter > 100:
		materials = append(materials, "gold")
		difficulty = "medium"
		value = int64(diameter * diameter * diameter * 300)
	default:
		value = int64(diameter * diameter * diameter * 50)
	}

	return models.MiningEconomy{
		EstimatedValueUSD: value,
		PrimaryMaterials:  materials,
		MiningDifficulty:  difficulty,
	}
}
