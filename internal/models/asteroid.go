package models

import "time"

// NASA NeoWs API response structures

type NeoWsResponse struct {
	NearEarthObjects map[string][]NeoObject `json:"near_earth_objects"`
}

type NeoObject struct {
	ID                   string              `json:"id"`
	Name                 string              `json:"name"`
	AbsoluteMagnitudeH   float64             `json:"absolute_magnitude_h"`
	EstimatedDiameter    EstimatedDiameter   `json:"estimated_diameter"`
	IsPotentiallyHazardous bool              `json:"is_potentially_hazardous_asteroid"`
	CloseApproachData    []CloseApproach     `json:"close_approach_data"`
}

type EstimatedDiameter struct {
	Meters DiameterRange `json:"meters"`
}

type DiameterRange struct {
	Min float64 `json:"estimated_diameter_min"`
	Max float64 `json:"estimated_diameter_max"`
}

type CloseApproach struct {
	RelativeVelocity  Velocity `json:"relative_velocity"`
	MissDistance      Distance `json:"miss_distance"`
	EpochDate         int64    `json:"epoch_date_close_approach"`
	OrbitingBody      string   `json:"orbiting_body"`
	CloseApproachDate string   `json:"close_approach_date"`
}

type Velocity struct {
	KmPerHour string `json:"kilometers_per_hour"`
}

type Distance struct {
	Kilometers string `json:"kilometers"`
}

// Internal enriched asteroid

type Asteroid struct {
	ID                string         `json:"id" bson:"_id"`
	Name              string         `json:"name" bson:"name"`
	IsHazardous       bool           `json:"is_hazardous" bson:"is_hazardous"`
	Metrics           Metrics        `json:"metrics" bson:"metrics"`
	MiningEconomy     MiningEconomy  `json:"mining_economy" bson:"mining_economy"`
	AISummary         map[string]string `json:"ai_summary,omitempty" bson:"ai_summary,omitempty"`
	UpdatedAt         time.Time      `json:"updated_at" bson:"updated_at"`
	CloseApproachDate string         `json:"close_approach_date" bson:"close_approach_date"`
}

type Metrics struct {
	DiameterMeters float64 `json:"diameter_meters" bson:"diameter_meters"`
	VelocityKmH    float64 `json:"velocity_km_h" bson:"velocity_km_h"`
	MissDistanceKm float64 `json:"miss_distance_km" bson:"miss_distance_km"`
}

type MiningEconomy struct {
	EstimatedValueUSD int64    `json:"estimated_value_usd" bson:"estimated_value_usd"`
	PrimaryMaterials  []string `json:"primary_materials" bson:"primary_materials"`
	MiningDifficulty  string   `json:"mining_difficulty" bson:"mining_difficulty"`
}

// API response

type APIResponse struct {
	Status string       `json:"status"`
	Meta   ResponseMeta `json:"meta"`
	Data   []Asteroid   `json:"data"`
}

type ResponseMeta struct {
	Cached         bool  `json:"cached"`
	ResponseTimeMs int64 `json:"response_time_ms"`
	TotalObjects   int   `json:"total_objects"`
}

type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}
