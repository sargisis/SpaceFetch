package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/sargisis/spacefetch/internal/ai"
	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/config"
	"github.com/sargisis/spacefetch/internal/database"
	"github.com/sargisis/spacefetch/internal/nasa"
	"github.com/sargisis/spacefetch/internal/worker"
)

func main() {
	cfg := config.Load()

	mdb, err := database.NewMongoDB(cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Fatalf("mongodb: %v", err)
	}
	defer mdb.Close()

	rcache, err := cache.NewRedisCache(cfg.RedisAddr, cfg.RedisPassword, cfg.CacheTTL)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer rcache.Close()

	nasaCli := nasa.NewClient(cfg.NASAAPIKey)

	aiCli, err := ai.NewClient(cfg.GroqAPIKey)
	if err != nil {
		log.Fatalf("ai client: %v", err)
	}
	defer aiCli.Close()

	w := worker.NewWorker(nasaCli, mdb, rcache, aiCli, cfg.WorkerInterval)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		w.Start(ctx)
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("worker shutting down...")
	cancel()
	wg.Wait()
	log.Println("worker exited gracefully")
}
