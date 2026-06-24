.PHONY: build-api build-worker run-api run-worker dev tidy

build-api:
	go build -o bin/api ./cmd/api

build-worker:
	go build -o bin/worker ./cmd/worker

build: build-api build-worker

run-api:
	go run ./cmd/api

run-worker:
	go run ./cmd/worker

dev:
	docker compose up -d
	sleep 2
	go run ./cmd/worker
	go run ./cmd/api

tidy:
	go mod tidy
