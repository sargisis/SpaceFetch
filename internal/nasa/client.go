package nasa

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io"
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
	defer drainAndClose(resp.Body)

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
	defer drainAndClose(resp.Body)

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
	defer drainAndClose(resp.Body)

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

// calculateEconomy estimates an asteroid's resource value with a volumetric
// model, the same approach popularized by Asterank / Planetary Resources:
//
//	value = volume × density(class) × recoverable value per ton(class)
//
// The spectral class (C/S/M) is not in the NeoWs feed, so it is assigned
// deterministically from the asteroid's ID following the real population
// distribution (~75% C, ~17% S, ~8% M). Densities are literature averages
// (Britt et al.); per-ton values are order-of-magnitude estimates of
// recoverable material worth. This is an educational estimate, not a market
// valuation — the site and docs label it as such.
func calculateEconomy(neo models.NeoObject) models.MiningEconomy {
	diameter := (neo.EstimatedDiameter.Meters.Min + neo.EstimatedDiameter.Meters.Max) / 2.0
	radius := diameter / 2.0
	volumeM3 := 4.0 / 3.0 * math.Pi * radius * radius * radius

	class := spectralClass(neo.ID)

	var densityTM3, valuePerTon float64
	var materials []string
	switch class {
	case "M": // metallic — iron-nickel with platinum-group metals
		densityTM3 = 5.32
		valuePerTon = 2500
		materials = []string{"iron", "nickel", "platinum", "cobalt", "gold"}
	case "S": // silicaceous — stony with metal grains
		densityTM3 = 2.71
		valuePerTon = 500
		materials = []string{"nickel", "iron", "cobalt", "magnesium silicates"}
	default: // C — carbonaceous: water and volatiles, valuable as in-space propellant
		densityTM3 = 1.38
		valuePerTon = 200
		materials = []string{"water", "organics", "iron", "nickel"}
	}

	massTons := volumeM3 * densityTM3
	value := int64(massTons * valuePerTon)

	// Difficulty combines target size (infrastructure needed) with approach
	// velocity (rendezvous delta-v proxy).
	var velocity float64
	if len(neo.CloseApproachData) > 0 {
		if v, err := strconv.ParseFloat(neo.CloseApproachData[0].RelativeVelocity.KmPerHour, 64); err == nil {
			velocity = v
		}
	}
	score := diameter/500.0 + velocity/50000.0
	difficulty := "low"
	switch {
	case score > 1.6:
		difficulty = "high"
	case score > 0.8:
		difficulty = "medium"
	}

	return models.MiningEconomy{
		EstimatedValueUSD: value,
		PrimaryMaterials:  materials,
		MiningDifficulty:  difficulty,
		SpectralClass:     class,
	}
}

// drainAndClose drains the response body to allow connection reuse,
// then closes it. Must be called via defer after every HTTP response.
func drainAndClose(body io.ReadCloser) {
	io.Copy(io.Discard, body)
	body.Close()
}

// spectralClass deterministically assigns a composition class from the
// asteroid ID, matching the observed near-Earth population distribution.
func spectralClass(id string) string {
	h := fnv.New32a()
	h.Write([]byte(id))
	switch n := h.Sum32() % 100; {
	case n < 75:
		return "C"
	case n < 92:
		return "S"
	default:
		return "M"
	}
}
