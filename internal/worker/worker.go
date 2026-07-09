package worker

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/sargisis/spacefetch/internal/ai"
	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/database"
	"github.com/sargisis/spacefetch/internal/models"
	"github.com/sargisis/spacefetch/internal/nasa"
)

type Worker struct {
	nasaCli  *nasa.Client
	db       *database.MongoDB
	cache    *cache.RedisCache
	aiCli    ai.Client
	interval time.Duration
	mu       sync.Mutex
	running  bool
}

func NewWorker(nasaCli *nasa.Client, db *database.MongoDB, cache *cache.RedisCache, aiCli ai.Client, interval time.Duration) *Worker {
	return &Worker{
		nasaCli:  nasaCli,
		db:       db,
		cache:    cache,
		aiCli:    aiCli,
		interval: interval,
	}
}

func (w *Worker) Start(ctx context.Context) {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.mu.Unlock()

	log.Printf("worker started, interval: %s", w.interval)

	// A failed sync (NASA rate limit, network blip) retries much sooner than
	// the regular interval so the data doesn't stay stale for hours.
	const retryDelay = 10 * time.Minute

	for {
		delay := w.interval
		if err := w.sync(ctx); err != nil {
			log.Printf("worker: sync failed, retrying in %s: %v", retryDelay, err)
			delay = retryDelay
		}

		select {
		case <-time.After(delay):
		case <-ctx.Done():
			log.Println("worker stopped")
			return
		}
	}
}

func (w *Worker) sync(ctx context.Context) error {
	log.Println("worker: fetching asteroids from NASA...")

	neos, err := w.nasaCli.FetchToday()
	if err != nil {
		return fmt.Errorf("NASA fetch: %w", err)
	}

	asteroids := make([]models.Asteroid, len(neos))
	for i, neo := range neos {
		asteroids[i] = nasa.Enrich(neo)
	}

	// Generate AI summaries in parallel (max 5 concurrent requests)
	if w.aiCli != nil {
		sem := make(chan struct{}, 5)
		var wg sync.WaitGroup

		for i := range asteroids {
			wg.Add(1)
			sem <- struct{}{}
			go func(a *models.Asteroid) {
				defer wg.Done()
				defer func() { <-sem }()

				log.Printf("worker: generating AI summary for asteroid %s...", a.Name)
				summaries, err := w.aiCli.GenerateSummaries(ctx, *a, []string{"en", "ru", "pl", "uk", "hy", "ka", "de", "es", "fr"})
				if err != nil {
					log.Printf("worker: AI summary error for %s: %v", a.Name, err)
					return
				}
				a.AISummary = summaries
			}(&asteroids[i])
		}
		wg.Wait()
	}

	log.Printf("worker: saving %d asteroids to MongoDB...", len(asteroids))
	if err := w.db.UpsertAsteroids(ctx, asteroids); err != nil {
		return fmt.Errorf("mongo upsert: %w", err)
	}

	// Warm the cache
	if err := w.cache.Set(ctx, asteroids); err != nil {
		log.Printf("worker: cache set error: %v", err)
	}

	log.Printf("worker: sync complete — %d asteroids", len(asteroids))
	return nil
}
