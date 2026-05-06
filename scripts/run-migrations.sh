#!/bin/bash
# Run Drizzle migrations. Requires DATABASE_URL in env or in .env.production / .env.local.
set -e

cd "$(dirname "$0")/.."

if [ -z "$DATABASE_URL" ]; then
  if [ -f .env.production ]; then
    set -a
    # shellcheck source=/dev/null
    . .env.production
    set +a
  elif [ -f .env.local ]; then
    set -a
    # shellcheck source=/dev/null
    . .env.local
    set +a
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Export it or add to .env.production / .env.local"
  exit 1
fi

echo "Running backend database migrations..."
python3 -m alembic -c backend/alembic.ini upgrade head
echo "Migrations complete."
