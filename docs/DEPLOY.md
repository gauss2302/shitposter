# Production deployment (VPS + Docker Compose + Nginx)

## Overview

Deploy the split stack (Next.js frontend, FastAPI backend, ARQ publishing
worker, Postgres, Redis) on a VPS from the repository root. The default
production Compose stack includes an `nginx` container as the only public HTTP
entrypoint:

- `/` → `web:3000` (Next.js)
- `/api/` → `backend:8000` (FastAPI)
- `postgres`, `redis`, and `backend-worker` stay internal to Docker.

For public production traffic, terminate HTTPS at the VPS edge (host Nginx with
Certbot, mounted certificates for the container, or a CDN/proxy such as
Cloudflare) and forward traffic to the Compose Nginx service.

## One-command deploy

On the VPS, from the repo root, with env set (e.g. `.env.production`):

```bash
./scripts/deploy-production.sh
```

This will:

1. `git pull origin main`
2. Load `.env.production` if it exists
3. Build and start the full Compose stack, including the one-off `migrate`
   service
4. Verify Nginx, backend, and frontend health through the public Nginx entrypoint

Manual equivalent:

```bash
docker compose up -d --build
curl -fsS http://localhost/nginx-health
curl -fsS http://localhost/api/v1/health
curl -fsS http://localhost/
```

## Environment variables

Set these in `.env.production` or export them before running the deploy script
and before starting containers.

| Variable | Description |
|----------|-------------|
| `NGINX_SERVER_NAME` | Domain served by container Nginx, e.g. `shitposter.yourdomain.com` (`_` by default). |
| `NGINX_HTTP_PORT` | Host HTTP port for container Nginx (`80` by default). |
| `NEXT_PUBLIC_APP_URL` / `FRONTEND_PUBLIC_URL` | Public frontend base URL, e.g. `https://shitposter.yourdomain.com`. |
| `BACKEND_PUBLIC_URL` | Public backend base URL. For same-origin Nginx routing, use the same domain as the frontend. |
| `NEXT_PUBLIC_API_BASE_URL` | Browser API base URL. Leave empty for same-origin `/api` routing through Nginx. |
| `INTERNAL_API_BASE_URL` | Server-side Next.js API URL inside Docker (`http://backend:8000` by default). |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres credentials used by Compose. Use a strong `DB_PASSWORD`. |
| `TOKEN_ENCRYPTION_KEY` | Strong secret for encrypting tokens (32+ random bytes/chars). |
| `SESSION_COOKIE_SECURE` | Use `true` for HTTPS production. |
| `SESSION_COOKIE_DOMAIN` | Optional cookie domain, e.g. `.yourdomain.com` for subdomains. |
| `SESSION_COOKIE_SAMESITE` | `lax`, `strict`, or `none`. |
| OAuth credentials | `TWITTER_*`, `LINKEDIN_*`, `GOOGLE_*` as needed. |
| AI credentials | `OPENAI_*`, `ANTHROPIC_*`, or `OPENAI_COMPATIBLE_*` as needed. |
| Polar credentials | `POLAR_*` as needed for billing. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Optional error tracking. |

## TLS and reverse proxy

The committed Compose stack publishes only Nginx by default. Internal services
use Docker networking and are not exposed on the host.

Recommended VPS setup:

1. Point the domain A record to the VPS.
2. Terminate HTTPS with one of:
   - host-level Nginx + Certbot forwarding to `http://127.0.0.1:${NGINX_HTTP_PORT:-80}`,
   - mounted TLS certificates in the container Nginx config,
   - Cloudflare or another HTTPS proxy in front of the VPS.
3. Set public URLs to `https://...`.
4. Keep `SESSION_COOKIE_SECURE=true`.

## OAuth callback URLs

For the default same-origin Nginx routing, configure providers with callbacks
on the same public domain:

- Google: `https://your-domain.com/api/v1/auth/google/callback`
- Twitter OAuth2: `https://your-domain.com/api/v1/social/callback/twitter`
- LinkedIn: `https://your-domain.com/api/v1/social/callback/linkedin`

If you deploy the API on a separate domain, use that domain for callbacks and
set `NEXT_PUBLIC_API_BASE_URL` / `BACKEND_PUBLIC_URL` accordingly.

## Dokploy

Dokploy/Traefik deployment remains available through the root
`docker-compose.dokploy.yml` file. In Dokploy, set **Compose Path** to:

```text
./docker-compose.dokploy.yml
```

Dokploy should route domains directly to the `web` and `backend` services.

## CI/CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`): On every PR and push to `main`, runs
  frontend lint/build/tests from `frontend/` and backend lint/tests from
  `backend/`.
- **Deploy** (`.github/workflows/deploy.yml`): On push to `main`, SSHs to the
  VPS and runs `./scripts/deploy-production.sh`.

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
2. Create `.env.production`.
3. Ensure the SSH user can run `git pull`, `./scripts/deploy-production.sh`, and
   Docker Compose (e.g. add user to the `docker` group).

## Rollback and migrations

- **Application**: Redeploy a previous commit (e.g. `git checkout <sha>` then
  run `./scripts/deploy-production.sh`). Migrations run on each deploy; ensure
  older code is compatible with the current DB schema.
- **Database**: Alembic migrations are forward-only by convention in this repo.
  Back up the DB before migrating (e.g. `pg_dump`). See [MIGRATIONS.md](MIGRATIONS.md).

## See also

- [MIGRATIONS.md](MIGRATIONS.md) — Running and rolling back migrations.
- [RUNBOOK.md](RUNBOOK.md) — Logs, health checks, and common issues.
- [METRICS.md](METRICS.md) — Worker Prometheus metrics and alerting.
