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

## Production

### Docker deployment

To run the full stack (web, worker, postgres, redis) with Docker:

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

- **Web**: `GET /api/health` (lightweight) or `GET /api/health?deep=1` (checks DB + Redis).
- **Worker**: `GET http://worker-host:3001/health` — queue and Redis status; `GET .../ready` for readiness; `GET .../metrics` for Prometheus.

See **[docs/RUNBOOK.md](docs/RUNBOOK.md)** for logs and common issues, and **[docs/METRICS.md](docs/METRICS.md)** for Prometheus and alerting.
