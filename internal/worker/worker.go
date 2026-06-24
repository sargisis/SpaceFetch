package worker

import (
	"context"
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

	// Run immediately on start
	w.sync(ctx)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.sync(ctx)
		case <-ctx.Done():
			log.Println("worker stopped")
			return
		}
	}
}

func (w *Worker) sync(ctx context.Context) {
	log.Println("worker: fetching asteroids from NASA...")

	neos, err := w.nasaCli.FetchToday()
	if err != nil {
		log.Printf("worker: NASA fetch error: %v", err)
		return
	}

	asteroids := make([]models.Asteroid, len(neos))
	for i, neo := range neos {
		a := nasa.Enrich(neo)
		if w.aiCli != nil {
			log.Printf("worker: generating AI summary for asteroid %s...", a.Name)
			summaries, err := w.aiCli.GenerateSummaries(ctx, a, []string{"en", "ru", "pl", "uk", "hy", "ka", "de", "es", "fr"})
			if err != nil {
				log.Printf("worker: AI summary error for %s: %v", a.Name, err)
			} else {
				a.AISummary = summaries
			}
		}
		asteroids[i] = a
	}

	log.Printf("worker: saving %d asteroids to MongoDB...", len(asteroids))
	if err := w.db.UpsertAsteroids(ctx, asteroids); err != nil {
		log.Printf("worker: mongo upsert error: %v", err)
		return
	}

	// Warm the cache
	if err := w.cache.Set(ctx, asteroids); err != nil {
		log.Printf("worker: cache set error: %v", err)
	}

	log.Printf("worker: sync complete — %d asteroids", len(asteroids))
}
