package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/sargisis/spacefetch/internal/models"
)

type groqClient struct {
	apiKey  string
	httpCli *http.Client
}

type fallbackClient struct{}

// NewClient returns a new Client implementation. If no valid API key is provided,
// it returns a fallback mock client to allow local testing and development.
func NewClient(apiKey string) (Client, error) {
	if apiKey == "" || apiKey == "demo" || apiKey == "mock" {
		return &fallbackClient{}, nil
	}
	return &groqClient{
		apiKey: apiKey,
		httpCli: &http.Client{
			Timeout: 15 * time.Second,
		},
	}, nil
}

func (c *groqClient) GenerateSummaries(ctx context.Context, asteroid models.Asteroid, languages []string) (map[string]string, error) {
	prompt := fmt.Sprintf(`Generate a short, engaging description (1-2 sentences) for an asteroid with the following parameters:
Name: %s
Estimated Diameter: %.1f meters
Relative Velocity: %.1f km/h
Miss Distance: %.1f km
Estimated Mining Value: %d USD
Primary Materials: %s
Mining Difficulty: %s

Provide the descriptions in the following languages: %s.
Return a JSON object where the keys are the language codes (e.g. "en", "ru") and the values are the generated short description strings for those languages.`,
		asteroid.Name,
		asteroid.Metrics.DiameterMeters,
		asteroid.Metrics.VelocityKmH,
		asteroid.Metrics.MissDistanceKm,
		asteroid.MiningEconomy.EstimatedValueUSD,
		strings.Join(asteroid.MiningEconomy.PrimaryMaterials, ", "),
		asteroid.MiningEconomy.MiningDifficulty,
		strings.Join(languages, ", "),
	)

	reqBody := map[string]interface{}{
		"model": "llama-3.3-70b-versatile",
		"messages": []interface{}{
			map[string]interface{}{
				"role":    "user",
				"content": prompt,
			},
		},
		"response_format": map[string]interface{}{
			"type": "json_object",
		},
	}

	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := "https://api.groq.com/openai/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqJSON))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpCli.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("groq returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var groqResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(groqResp.Choices) == 0 {
		return nil, fmt.Errorf("empty groq response choices")
	}

	rawText := groqResp.Choices[0].Message.Content
	var result map[string]string
	if err := json.Unmarshal([]byte(rawText), &result); err != nil {
		return nil, fmt.Errorf("parse json summary response: %w (raw response: %s)", err, rawText)
	}

	return result, nil
}

func (c *groqClient) Close() error {
	return nil
}

// fallbackClient implementation for local mock testing
func (f *fallbackClient) GenerateSummaries(ctx context.Context, asteroid models.Asteroid, languages []string) (map[string]string, error) {
	result := make(map[string]string)
	for _, lang := range languages {
		switch lang {
		case "ru":
			result["ru"] = fmt.Sprintf("Астероид %s диаметром %.1f метров движется со скоростью %.1f км/ч. Оценочная стоимость добычи: %d USD.", asteroid.Name, asteroid.Metrics.DiameterMeters, asteroid.Metrics.VelocityKmH, asteroid.MiningEconomy.EstimatedValueUSD)
		default:
			result[lang] = fmt.Sprintf("Asteroid %s with diameter %.1f meters moving at %.1f km/h. Estimated mining value: %d USD.", asteroid.Name, asteroid.Metrics.DiameterMeters, asteroid.Metrics.VelocityKmH, asteroid.MiningEconomy.EstimatedValueUSD)
		}
	}
	return result, nil
}

func (f *fallbackClient) Close() error {
	return nil
}
