#!/bin/bash
set -e

echo "🚀 Deploying shitpost.art worker..."

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Build new image
echo "🔨 Building Docker image..."
docker-compose build worker

# Graceful restart
echo "🔄 Restarting worker with zero downtime..."
docker-compose up -d --no-deps --build worker

# Wait for health check
echo "⏳ Waiting for health check..."
sleep 10

# Check health
if curl -sf http://localhost:3001/health > /dev/null; then
    echo "✅ Worker is healthy!"
    docker-compose logs --tail=20 worker
else
    echo "❌ Worker health check failed!"
    docker-compose logs --tail=50 worker
    exit 1
fi

echo "🎉 Deployment complete!"