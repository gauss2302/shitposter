This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Architecture

The app is split into three runtime services:

- `web`: Next.js frontend. It renders UI and calls the backend through
  `NEXT_PUBLIC_API_BASE_URL`.
- `backend`: FastAPI service. It owns auth/session cookies, PostgreSQL access,
  Redis access, OAuth/social integrations, Polar billing, post scheduling,
  analytics, health checks, and migrations.
- `backend-worker`: Python ARQ worker. It consumes Redis publishing jobs created
  by the backend and updates post/target status in PostgreSQL.

Server-side business logic should live in `backend/app/**`, not in Next.js API
routes or frontend components.

## Local development

```bash
# Frontend only
npm run dev

# Full stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Backend checks
cd backend
python -m ruff check .
python -m pytest
```

## Production

### Docker deployment

To run the full stack (web, backend, backend-worker, postgres, redis) with Docker:

```bash
# Run migrations before first start (from host, with DB reachable)
./scripts/run-migrations.sh
# or: npm run db:migrate

# Start all services
docker compose up -d
```

**Full production deploy** (pull, migrate, build, restart web + worker):

```bash
./scripts/deploy-production.sh
```

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for production env vars, TLS, and CI/CD setup.

**Before deploying:**

1. **Migrations** — Run before starting or updating app/worker. Use `./scripts/run-migrations.sh` or `npm run db:migrate`. See [docs/MIGRATIONS.md](docs/MIGRATIONS.md).
2. **App URL** — Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to your public base URL (e.g. `https://your-domain.com`) for auth callbacks.
3. **Secrets** — Use strong values for `TOKEN_ENCRYPTION_KEY`, DB passwords, and OAuth credentials.
4. **Reverse proxy** — Put nginx, Caddy, or Traefik in front for TLS and domain routing.

### Health and monitoring

- **Backend**: `GET /api/v1/health` (lightweight) or `GET /api/v1/health?deep=1` (checks DB + Redis).
- **Worker**: ARQ worker process; inspect via backend logs and Redis/ARQ queue keys.

See **[docs/RUNBOOK.md](docs/RUNBOOK.md)** for logs and common issues, and **[docs/METRICS.md](docs/METRICS.md)** for Prometheus and alerting.
