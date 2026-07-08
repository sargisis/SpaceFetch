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

    # Automatically start database containers if docker is running
    if command -v docker >/dev/null 2>&1; then
        if docker info >/dev/null 2>&1; then
            echo "🐳 Docker daemon is running. Ensuring database containers are active..."

            # MongoDB container check/start
            if [ "$(docker ps -a -q -f name=spacefetch-mongo)" ]; then
                if [ "$(docker inspect -f '{{.State.Running}}' spacefetch-mongo 2>/dev/null)" != "true" ]; then
                    echo "🔄 Starting existing spacefetch-mongo container..."
                    docker start spacefetch-mongo >/dev/null
                fi
            else
                echo "🚀 Creating and starting spacefetch-mongo container..."
                docker run -d --name spacefetch-mongo -p 27017:27017 -v mongo-data:/data/db -e MONGO_INITDB_DATABASE=spacefetch mongo:7 >/dev/null
            fi

            # Redis container check/start
            if [ "$(docker ps -a -q -f name=spacefetch-redis)" ]; then
                if [ "$(docker inspect -f '{{.State.Running}}' spacefetch-redis 2>/dev/null)" != "true" ]; then
                    echo "🔄 Starting existing spacefetch-redis container..."
                    docker start spacefetch-redis >/dev/null
                fi
            else
                echo "🚀 Creating and starting spacefetch-redis container..."
                docker run -d --name spacefetch-redis -p 6379:6379 -v redis-data:/data redis:7-alpine >/dev/null
            fi
        else
            echo "⚠️ Docker daemon is installed but not running. Please make sure MongoDB and Redis are running locally."
        fi
    else
        echo "⚠️ Docker is not installed. Please make sure MongoDB and Redis are running locally."
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
    if command -v npm >/dev/null 2>&1; then
        echo "Starting Vite Dev Server on port 5173..."
        cd frontend && npm run dev &
        FRONT_PID=$!
        cd ..
    else
        echo "⚠️ npm was not found. Skipping Vite Dev Server. The Go API server will serve frontend static files from $FRONTEND_DIR if built."
        FRONT_PID=""
    fi

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
