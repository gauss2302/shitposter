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

### Docker Deployment

To run the full stack (web, worker, postgres, redis) with Docker:

```bash
# Run migrations before first start (from host, with DB reachable)
bun run db:migrate

# Start all services
docker compose up -d
```

**Before deploying:**

1. **Migrations** — Run `bun run db:migrate` (or `drizzle-kit migrate`) before starting. Containers do not run migrations automatically.
2. **App URL** — Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to your public base URL (e.g. `https://your-domain.com`) for auth callbacks.
3. **Secrets** — Use strong values for `TOKEN_ENCRYPTION_KEY`, DB passwords, and OAuth credentials.
4. **Reverse proxy** — Put nginx, Caddy, or Traefik in front for TLS and domain routing.

### Health and Uptime Monitoring

For production, use an external monitor (e.g. UptimeRobot, Better Stack, PagerDuty) to hit these endpoints on an interval (e.g. 1–5 minutes):

- **Next.js app**: `GET /api/health` — returns 200 when the web app is running.
- **Worker**: `GET http://worker-host:HEALTH_PORT/health` — returns 200 and queue/Redis status when the worker is healthy. Default port is 3001 (`HEALTH_PORT`).
- **Worker readiness** (e.g. Kubernetes): `GET http://worker-host:HEALTH_PORT/ready` — returns 200 when ready to accept jobs.
- **Prometheus metrics**: `GET http://worker-host:HEALTH_PORT/metrics` — worker job counts and uptime in Prometheus format.

Configure alerts when any health check returns non-2xx or times out.
