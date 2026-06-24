#!/bin/bash

MODE=${1:-docker}

if [ "$MODE" = "docker" ]; then
    echo "=== Starting SpaceFetch via Docker ==="
    # Try running docker compose up
    if docker compose up --build; then
        echo "Containers started successfully."
    else
        echo "Failed to run docker compose without privileges. Trying with sudo..."
        sudo docker compose up --build
    fi
elif [ "$MODE" = "local" ]; then
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
