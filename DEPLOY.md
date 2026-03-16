# Deploying Shitposter to Dokploy

This guide covers deploying the Shitposter app to [Dokploy](https://dokploy.com) on a VPS. Dokploy runs on port 3000; the app is served via Traefik on ports 80/443.

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
| `NEXT_PUBLIC_APP_URL` | Full app URL, e.g. `https://shitposter.yourdomain.com` |
| `BETTER_AUTH_URL` | Same as `NEXT_PUBLIC_APP_URL` |
| `DB_PASSWORD` | Strong Postgres password |
| `BETTER_AUTH_SECRET` | Random 32+ char string |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| OAuth credentials | For Twitter, Google, LinkedIn, etc. |

### 3. Configure domains

In **Domains** tab:

1. **Main app**: Add domain (e.g. `shitposter.yourdomain.com`) → select **web** service
2. **Bull Board** (optional): Add `queue.yourdomain.com` → select **bull-board** service

Dokploy will add Traefik labels and HTTPS (Let's Encrypt) automatically.

### 4. Deploy

Click **Deploy**. First build may take 5–10 minutes.

## Migrations

Database migrations run automatically on each deploy via the `migrate` service. It runs before `web` and `worker` start.

## Architecture

```
                    ┌─────────────────┐
                    │  Traefik (80/443)│
                    └────────┬────────┘
                             │ dokploy-network
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         ┌─────────┐   ┌─────────────┐
         │   web   │   │  bull-board │
         │ (Next.js)│   │  (optional) │
         └────┬────┘   └─────────────┘
              │
              │ shitpost-network
    ┌─────────┼─────────┬─────────────┐
    ▼         ▼         ▼             ▼
┌────────┐ ┌──────┐ ┌───────┐   ┌──────────┐
│postgres│ │ redis│ │ worker│   │bull-board│
└────────┘ └──────┘ └───────┘   └──────────┘
```

- **migrate**: Runs Drizzle migrations (one-off, then exits)
- **web**: Next.js app (port 3000)
- **worker**: BullMQ job processor
- **postgres**: PostgreSQL 16
- **redis**: Redis 7
- **bull-board**: Queue dashboard (optional)

## OAuth callback URLs

Update OAuth apps with your production URLs:

- **Twitter**: `https://your-domain.com/api/auth/callback/twitter`
- **Google**: `https://your-domain.com/api/auth/callback/google`
- **LinkedIn**: `https://your-domain.com/api/auth/callback/linkedin`
- **Facebook**: `https://your-domain.com/api/auth/callback/facebook`
- **TikTok**: `https://your-domain.com/api/auth/callback/tiktok`

## Subpath deployment

If Dokploy serves the app under a subpath (e.g. `/baas-shitposter-xxx`):

1. Set `NEXT_PUBLIC_BASE_PATH=/baas-shitposter-xxx` in Environment
2. Rebuild (basePath is baked into the Next.js build)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Domain not loading | Check A record, wait ~10s for Traefik certs |
| OAuth redirect fails | Ensure `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` match domain |
| Build fails (OOM) | Increase VPS RAM or add swap |
| Worker not processing | Check Redis connection, view worker logs in Dokploy |

## Volumes & backups

Postgres and Redis use Docker named volumes. Enable **Volume Backups** in Dokploy for automated S3 backups.
