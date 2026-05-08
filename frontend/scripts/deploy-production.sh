#!/bin/bash
# Full production deploy: pull, migrations, build and start web + worker.
# Usage: run on VPS from repo root, with env set (e.g. .env.production) or export DATABASE_URL etc.
set -e

echo "🚀 Deploying shitposter (frontend + FastAPI backend + Python worker)..."

# Optional: backup DB before migrations (uncomment and set BACKUP_DIR if desired)
# BACKUP_DIR="${BACKUP_DIR:-./backups}"
# mkdir -p "$BACKUP_DIR"
# pg_dump "$DATABASE_URL" > "$BACKUP_DIR/pre-$(date +%Y%m%d-%H%M%S).sql" || true

# 1. Pull latest
echo "📥 Pulling latest code..."
git pull origin main

# 2. Source production env if present
if [ -f .env.production ]; then
  set -a
  # shellcheck source=/dev/null
  . .env.production
  set +a
  echo "Loaded .env.production"
fi

# 3. Run migrations (requires DATABASE_URL)
echo "📦 Running database migrations..."
./scripts/run-migrations.sh

# 4. Build and start frontend/backend/worker
echo "🔨 Building and starting services..."
docker-compose build web backend backend-worker
docker-compose up -d --no-deps web backend backend-worker

# 5. Wait and verify health
echo "⏳ Waiting for health checks..."
sleep 15

WEB_URL="${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL must be set}"
BACKEND_URL="${BACKEND_PUBLIC_URL:-http://localhost:8000}"
WEB_HEALTH="${WEB_URL}/"
BACKEND_HEALTH="${BACKEND_URL}/api/v1/health?deep=1"

if curl -sf "$WEB_HEALTH" > /dev/null; then
  echo "✅ Web is healthy ($WEB_HEALTH)"
else
  echo "❌ Web health check failed ($WEB_HEALTH)"
  docker-compose logs --tail=30 web
  exit 1
fi

if curl -sf "$BACKEND_HEALTH" > /dev/null; then
  echo "✅ Backend is healthy ($BACKEND_HEALTH)"
  docker-compose logs --tail=20 backend
else
  echo "❌ Backend health check failed ($BACKEND_HEALTH)"
  docker-compose logs --tail=50 backend
  exit 1
fi

echo "🎉 Deployment complete!"
