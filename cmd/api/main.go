package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sargisis/spacefetch/internal/api"
	"github.com/sargisis/spacefetch/internal/cache"
	"github.com/sargisis/spacefetch/internal/config"
	"github.com/sargisis/spacefetch/internal/database"
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

	router := api.NewRouter(mdb, rcache, cfg.FrontendDir)

	server := &http.Server{
		Addr:    ":" + cfg.APIPort,
		Handler: router,
	}

	go func() {
		log.Printf("API server listening on :%s", cfg.APIPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down API server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("API server forced to shutdown: %v", err)
	}

	log.Println("API server exited gracefully")
}
