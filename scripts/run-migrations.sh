#!/bin/bash
# Run backend Alembic migrations through the root Docker Compose stack.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env.production ]; then
  set -a
  # shellcheck source=/dev/null
  . .env.production
  set +a
  echo "Loaded .env.production"
elif [ -f .env.local ]; then
  set -a
  # shellcheck source=/dev/null
  . .env.local
  set +a
  echo "Loaded .env.local"
fi

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

echo "Starting PostgreSQL dependency..."
compose up -d postgres

echo "Building migration image..."
compose build migrate

echo "Running backend database migrations..."
compose run --rm migrate
echo "Migrations complete."
