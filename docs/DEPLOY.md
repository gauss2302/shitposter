# Production deployment (VPS + Docker Compose)

## Overview

Deploy the full stack (Next.js web, BullMQ worker, Postgres, Redis) on a VPS using Docker Compose. TLS should be terminated at a reverse proxy (Caddy, nginx, or Traefik) in front of the app.

## One-command deploy

On the VPS, from the repo root, with env set (e.g. `.env.production`):

```bash
./scripts/deploy-production.sh
```

This will:

1. `git pull origin main`
2. Run database migrations (`./scripts/run-migrations.sh`)
3. Build and start `web` and `worker` with `docker-compose up -d --no-deps web worker`
4. Verify web and worker health; exit 1 if either fails

Ensure Postgres and Redis are already running (e.g. `docker-compose up -d postgres redis` on first run, or use the same compose file and start all services once).

## Environment variables

Set these in `.env.production` or export them before running the deploy script and before starting containers.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string (used by migrations and app). |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Alternative to `DATABASE_URL` for compose; can be derived from it. |
| `REDIS_URL` | Redis connection string (e.g. `redis://redis:6379` inside compose). |
| `TOKEN_ENCRYPTION_KEY` | Strong secret for encrypting tokens (e.g. 32+ chars). |
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `https://your-domain.com`) for auth and redirects. |
| `BETTER_AUTH_URL` | Same as `NEXT_PUBLIC_APP_URL` for better-auth. |
| `NEXT_PUBLIC_BASE_PATH` | Optional subpath (e.g. `/app`) if app is not at root. |
| OAuth credentials | `TWITTER_*`, `TIKTOK_*`, `LINKEDIN_*`, `FACEBOOK_*`, `GOOGLE_*` as needed. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Optional; set for error tracking. |

Migrations read `DATABASE_URL` from the environment or from `.env.production` / `.env.local`. See [MIGRATIONS.md](MIGRATIONS.md).

## TLS and reverse proxy

Do not expose the Next.js or worker ports directly to the internet. Use a reverse proxy to:

- Terminate TLS (HTTPS).
- Route your domain to the web container (e.g. port 3010 or 3000).
- Optionally protect the worker health port or expose it only on localhost / internal network.

Example (Caddy): route `your-domain.com` to `http://localhost:3010` and let Caddy handle HTTPS.

## CI/CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`): On every PR and push to `main`, runs lint, build, and tests.
- **Deploy** (`.github/workflows/deploy.yml`): On push to `main`, SSHs to the VPS and runs `./scripts/deploy-production.sh`.

### Required secrets

Configure in the repo **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | VPS hostname or IP. |
| `SSH_USER` | SSH user (e.g. `deploy` or `root`). |
| `SSH_PRIVATE_KEY` | Private key for SSH (full PEM, including `-----BEGIN ...-----`). |
| `DEPLOY_PATH` | Absolute path to the repo on the VPS (e.g. `/var/www/shitposter`). |

On the VPS:

1. Clone the repo (or ensure it exists) at `DEPLOY_PATH`.
2. Create `.env.production` (or otherwise set env) so that when the workflow runs `./scripts/deploy-production.sh`, `DATABASE_URL` and other vars are available (e.g. by sourcing `.env.production` from the deploy script, which the script already does if the file exists).
3. Ensure the SSH user can run `git pull`, `npm run db:migrate`, and `docker-compose` (e.g. add user to `docker` group).

## Rollback and migrations

- **Application**: Redeploy a previous commit (e.g. `git checkout <sha>` then run `./scripts/deploy-production.sh`). Migrations are run on each deploy; ensure older code is compatible with the current DB schema.
- **Database**: Drizzle does not generate down migrations. Back up the DB before migrating (e.g. `pg_dump`). See [MIGRATIONS.md](MIGRATIONS.md).

## See also

- [MIGRATIONS.md](MIGRATIONS.md) — Running and rolling back migrations.
- [RUNBOOK.md](RUNBOOK.md) — Logs, health checks, and common issues.
- [METRICS.md](METRICS.md) — Worker Prometheus metrics and alerting.
