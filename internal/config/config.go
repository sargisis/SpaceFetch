package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	NASAAPIKey     string
	GroqAPIKey     string
	MongoURI       string
	MongoDB        string
	RedisAddr      string
	RedisPassword  string
	APIPort        string
	WorkerInterval time.Duration
	CacheTTL       time.Duration
}

func Load() *Config {
	return &Config{
		NASAAPIKey:     getEnv("NASA_API_KEY", "demo"),
		GroqAPIKey:     getEnv("GROQ_API_KEY", ""),
		MongoURI:       getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:        getEnv("MONGO_DB", "spacefetch"),
		RedisAddr:      getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:  getEnv("REDIS_PASSWORD", ""),
		APIPort:        getEnv("API_PORT", "8080"),
		WorkerInterval: getDuration("WORKER_INTERVAL", 6*time.Hour),
		CacheTTL:       getDuration("CACHE_TTL", 1*time.Hour),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		d, err := time.ParseDuration(v)
		if err == nil {
			return d
		}
		sec, err := strconv.Atoi(v)
		if err == nil {
			return time.Duration(sec) * time.Second
		}
	}
	return fallback
}
