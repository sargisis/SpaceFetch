#!/bin/bash

MODE=${1:-docker}

# Detect if Docker Compose is available
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif docker-compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD=""
fi

if [ "$MODE" = "docker" ]; then
    if [ -z "$COMPOSE_CMD" ]; then
        echo "⚠️ Docker Compose was not found on your system."
        echo "🔄 Falling back to local execution mode (Go backend + React frontend)..."
        MODE="local"
    else
        echo "=== Starting SpaceFetch via Docker ($COMPOSE_CMD) ==="
        if $COMPOSE_CMD up --build; then
            echo "Containers started successfully."
            exit 0
        else
            echo "Failed to run compose. Trying with sudo..."
            sudo $COMPOSE_CMD up --build
            exit 0
        fi
    fi
fi

if [ "$MODE" = "local" ]; then
    echo "=== Starting SpaceFetch locally ==="
    
    # Load env
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    else
        echo ".env file not found!"
        exit 1
    fi

    # Compile backend first
    echo "Building backend binaries..."
    go build -o bin/api ./cmd/api
    go build -o bin/worker ./cmd/worker

    # Start Go API
    echo "Starting API Server on port 8080..."
    ./bin/api &
    API_PID=$!

    # Start Go Worker
    echo "Starting Background Worker..."
    ./bin/worker &
    WORKER_PID=$!

    # Start React Frontend
    echo "Starting Vite Dev Server on port 5173..."
    cd frontend && npm run dev &
    FRONT_PID=$!
    cd ..

    # Handle graceful exit of all local background processes on ctrl+c
    cleanup() {
        echo ""
        echo "Shutting down local processes..."
        kill $API_PID $WORKER_PID $FRONT_PID 2>/dev/null
        exit 0
    }
    trap cleanup SIGINT SIGTERM

    echo "Services running. Press Ctrl+C to terminate all."
    # Wait for background jobs to finish
    wait
else
    echo "Unknown mode: $MODE"
    echo "Usage: ./run.sh [docker|local]"
    exit 1
fi
