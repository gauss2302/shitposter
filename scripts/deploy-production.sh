#!/bin/bash
# Full production deploy: pull, migrations, build and start web + worker.
# Usage: run on VPS from repo root, with env set (e.g. .env.production) or export DATABASE_URL etc.
set -e

echo "🚀 Deploying shitposter (web + worker)..."

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

# 4. Build and start web + worker
echo "🔨 Building and starting services..."
docker-compose build web worker
docker-compose up -d --no-deps web worker

# 5. Wait and verify health
echo "⏳ Waiting for health checks..."
sleep 15

WEB_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3010}"
WEB_HEALTH="${WEB_URL}/api/health"
WORKER_HEALTH="http://localhost:3001/health"

if curl -sf "$WEB_HEALTH" > /dev/null; then
  echo "✅ Web is healthy ($WEB_HEALTH)"
else
  echo "❌ Web health check failed ($WEB_HEALTH)"
  docker-compose logs --tail=30 web
  exit 1
fi

if curl -sf "$WORKER_HEALTH" > /dev/null; then
  echo "✅ Worker is healthy ($WORKER_HEALTH)"
  docker-compose logs --tail=20 worker
else
  echo "❌ Worker health check failed ($WORKER_HEALTH)"
  docker-compose logs --tail=50 worker
  exit 1
fi

echo "🎉 Deployment complete!"
