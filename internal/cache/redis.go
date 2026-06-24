package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/sargisis/spacefetch/internal/models"
)

const asteroidsKey = "asteroids:today"

type RedisCache struct {
	cli *redis.Client
	ttl time.Duration
}

func NewRedisCache(addr, password string, ttl time.Duration) (*RedisCache, error) {
	cli := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
	})

	if err := cli.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	return &RedisCache{cli: cli, ttl: ttl}, nil
}

func (r *RedisCache) Get(ctx context.Context) ([]models.Asteroid, bool, error) {
	data, err := r.cli.Get(ctx, asteroidsKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, false, nil
		}
		return nil, false, err
	}

	var asteroids []models.Asteroid
	if err := json.Unmarshal(data, &asteroids); err != nil {
		return nil, false, err
	}

	return asteroids, true, nil
}

func (r *RedisCache) Set(ctx context.Context, asteroids []models.Asteroid) error {
	data, err := json.Marshal(asteroids)
	if err != nil {
		return err
	}

	return r.cli.Set(ctx, asteroidsKey, data, r.ttl).Err()
}

func (r *RedisCache) Close() error {
	return r.cli.Close()
}

// Rate limiting

func (r *RedisCache) CheckRateLimit(ctx context.Context, apiKey string, limit int, window time.Duration) (bool, error) {
	key := fmt.Sprintf("ratelimit:%s", apiKey)
	val, err := r.cli.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}
	if val == 1 {
		// first request in window — set expiry
		r.cli.Expire(ctx, key, window)
	}
	return val <= int64(limit), nil
}
