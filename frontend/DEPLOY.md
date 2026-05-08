# Deploying Shitposter to Dokploy

This guide covers deploying the separated stack (Next.js frontend, FastAPI
backend, Python ARQ worker, Postgres, Redis) to [Dokploy](https://dokploy.com).

## Prerequisites

- VPS with at least 2GB RAM, 30GB disk (Ubuntu 20.04+, Debian 11/12, or CentOS)
- Docker and Docker Compose
- Dokploy installed (`curl -sSL https://dokploy.com/install.sh | sh`)
- Domain with A record pointing to your VPS IP

## Quick Start

### 1. Create a new Docker Compose application in Dokploy

1. Open Dokploy at `http://<your-vps-ip>:3000`
2. Create a new **Project**
3. Add a **Compose** service, type: **Docker Compose**
4. Connect your Git repository (GitHub, GitLab, etc.)
5. Set **Compose Path** to: `./docker-compose.dokploy.yml`
6. Select branch (e.g. `main`)

### 2. Configure environment variables

In **Environment** tab, add variables from `.env.dokploy.example`. Required:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Frontend URL, e.g. `https://shitposter.yourdomain.com` |
| `NEXT_PUBLIC_API_BASE_URL` | Public backend URL, e.g. `https://api.shitposter.yourdomain.com` |
| `FRONTEND_PUBLIC_URL` | Same as frontend URL |
| `BACKEND_PUBLIC_URL` | Same as backend URL |
| `DB_PASSWORD` | Strong Postgres password |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| OAuth credentials | For Twitter, Google, LinkedIn, etc. |

### 3. Configure domains

In **Domains** tab:

1. **Frontend**: Add domain (e.g. `shitposter.yourdomain.com`) → select **web** service.
2. **Backend**: Add domain (e.g. `api.shitposter.yourdomain.com`) → select **backend** service.

Dokploy will add Traefik labels and HTTPS (Let's Encrypt) automatically.

### 4. Deploy

Click **Deploy**. First build may take 5–10 minutes.

## Migrations

Database migrations run automatically on each deploy via the `migrate`
service. It runs Alembic before `web`, `backend`, and `backend-worker` start.

## Architecture

```
                    ┌─────────────────┐
                    │  Traefik (80/443)│
                    └────────┬────────┘
                             │ dokploy-network
              ┌──────────────┴──────────────┐
              ▼                             ▼
         ┌─────────┐                 ┌──────────┐
         │   web   │                 │ backend  │
         │ Next.js │                 │ FastAPI  │
         └────┬────┘                 └────┬─────┘
              │                           │
              │ shitpost-network
    ┌─────────┼─────────┬─────────────┐
    ▼         ▼         ▼             ▼
┌────────┐ ┌──────┐ ┌─────────┐ ┌──────────────┐
│postgres│ │redis │ │ backend │ │backend-worker│
└────────┘ └──────┘ └─────────┘ └──────────────┘
```

- **migrate**: Runs Alembic migrations (one-off, then exits)
- **web**: Next.js frontend
- **backend**: FastAPI API service
- **backend-worker**: ARQ publishing worker
- **postgres**: PostgreSQL 16
- **redis**: Redis 7

## OAuth callback URLs

Update OAuth apps with your production URLs:

- **Google**: `https://api.your-domain.com/api/v1/auth/google/callback`
- **Twitter OAuth2**: `https://api.your-domain.com/api/v1/social/callback/twitter`
- **LinkedIn**: `https://api.your-domain.com/api/v1/social/callback/linkedin`

## Subpath deployment

If Dokploy serves the app under a subpath (e.g. `/baas-shitposter-xxx`):

1. Set `NEXT_PUBLIC_BASE_PATH=/baas-shitposter-xxx` in Environment
2. Rebuild (basePath is baked into the Next.js build)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Domain not loading | Check A record, wait ~10s for Traefik certs |
| OAuth redirect fails | Ensure frontend/backend public URLs and provider callback URLs match |
| Build fails (OOM) | Increase VPS RAM or add swap |
| Worker not processing | Check Redis connection and backend-worker logs in Dokploy |

## Volumes & backups

Postgres and Redis use Docker named volumes. Enable **Volume Backups** in Dokploy for automated S3 backups.
