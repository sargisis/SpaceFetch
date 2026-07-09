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

const (
	neoWsURL   = "https://api.nasa.gov/neo/rest/v1/feed"
	apodURL    = "https://api.nasa.gov/planetary/apod"
	epicURL    = "https://epic.gsfc.nasa.gov/api/natural"
	epicImgURL = "https://epic.gsfc.nasa.gov/archive/natural"
)

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

// FetchAPOD returns NASA's Astronomy Picture of the Day, normalized.
func (c *Client) FetchAPOD() (*models.APOD, error) {
	u := fmt.Sprintf("%s?api_key=%s", apodURL, c.apiKey)
	resp, err := c.httpCli.Get(u)
	if err != nil {
		return nil, fmt.Errorf("apod request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("apod returned status %d", resp.StatusCode)
	}

	var raw struct {
		Date        string `json:"date"`
		Title       string `json:"title"`
		Explanation string `json:"explanation"`
		MediaType   string `json:"media_type"`
		URL         string `json:"url"`
		HDURL       string `json:"hdurl"`
		Copyright   string `json:"copyright"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("apod decode failed: %w", err)
	}

	return &models.APOD{
		Date:        raw.Date,
		Title:       raw.Title,
		Explanation: raw.Explanation,
		MediaType:   raw.MediaType,
		URL:         raw.URL,
		HDURL:       raw.HDURL,
		Copyright:   raw.Copyright,
	}, nil
}

// FetchEPICLatest returns the most recent Earth photo from the DSCOVR EPIC
// camera with a direct image URL (the EPIC archive is keyless).
func (c *Client) FetchEPICLatest() (*models.EPICImage, error) {
	resp, err := c.httpCli.Get(epicURL)
	if err != nil {
		return nil, fmt.Errorf("epic request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("epic returned status %d", resp.StatusCode)
	}

	var raw []struct {
		Image               string `json:"image"`
		Caption             string `json:"caption"`
		Date                string `json:"date"` // "2026-07-09 00:50:27"
		CentroidCoordinates struct {
			Lat float64 `json:"lat"`
			Lon float64 `json:"lon"`
		} `json:"centroid_coordinates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("epic decode failed: %w", err)
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("epic returned no images")
	}

	latest := raw[0]
	taken, err := time.Parse("2006-01-02 15:04:05", latest.Date)
	if err != nil {
		return nil, fmt.Errorf("epic date parse failed: %w", err)
	}

	return &models.EPICImage{
		Date:      latest.Date,
		Caption:   latest.Caption,
		ImageURL:  fmt.Sprintf("%s/%s/png/%s.png", epicImgURL, taken.Format("2006/01/02"), latest.Image),
		Latitude:  latest.CentroidCoordinates.Lat,
		Longitude: latest.CentroidCoordinates.Lon,
	}, nil
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
