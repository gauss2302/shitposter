#!/bin/bash
# Full production deploy: pull, build, migrate, start, and verify the VPS stack.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "ERROR: Docker Compose is not installed." >&2
    exit 1
  fi
}

echo "🚀 Deploying shitposter VPS stack..."

echo "📥 Pulling latest code..."
git pull origin main

if [ -f .env.production ]; then
  set -a
  # shellcheck source=/dev/null
  . .env.production
  set +a
  echo "Loaded .env.production"
fi

echo "🔨 Building and starting services..."
compose up -d --build

echo "⏳ Waiting for health checks..."
sleep "${DEPLOY_HEALTH_WAIT_SECONDS:-20}"

HTTP_PORT="${NGINX_HTTP_PORT:-80}"
if [ "$HTTP_PORT" = "80" ]; then
  DEFAULT_HEALTH_BASE_URL="http://localhost"
else
  DEFAULT_HEALTH_BASE_URL="http://localhost:${HTTP_PORT}"
fi
HEALTH_BASE_URL="${DEPLOY_HEALTH_BASE_URL:-$DEFAULT_HEALTH_BASE_URL}"

check_url() {
  local label="$1"
  local url="$2"

  if curl -fsS "$url" > /dev/null; then
    echo "✅ ${label} is healthy (${url})"
  else
    echo "❌ ${label} health check failed (${url})"
    compose ps
    compose logs --tail=80 nginx web backend
    exit 1
  fi
}

check_url "Nginx" "${HEALTH_BASE_URL}/nginx-health"
check_url "Backend" "${HEALTH_BASE_URL}/api/v1/health?deep=1"
check_url "Web" "${HEALTH_BASE_URL}/"

echo "🎉 Deployment complete!"
