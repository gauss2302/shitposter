# Runbook — shitposter production

## Logs

### Docker Compose

- **All services**: `docker-compose logs -f`
- **Web**: `docker-compose logs -f web`
- **Worker**: `docker-compose logs -f worker`
- **Last N lines**: `docker-compose logs --tail=100 worker`

Logs are JSON in production (one object per line) when `NODE_ENV=production`. Configure your log shipper (Datadog, Loki, CloudWatch, etc.) to parse JSON and index `level`, `message`, `timestamp`.

### Log level

Set `LOG_LEVEL` to `debug`, `info`, `warn`, or `error`. Default in production is `info`.

---

## Health endpoints

### Web

- **Lightweight (for load balancers)**: `GET /api/health` — returns 200 when the process is up.
- **Deep (for alerting)**: `GET /api/health?deep=1` — checks Postgres and Redis; returns 503 if either is down. Body includes `database` and `redis` status.

### Worker

- **Health**: `GET http://localhost:3001/health` — JSON with `status`, `redis`, `queue`, `worker` stats. Returns 503 if Redis is disconnected.
- **Ready**: `GET http://localhost:3001/ready` — 200 when the worker is ready to accept jobs (e.g. for Kubernetes readiness).
- **Metrics**: `GET http://localhost:3001/metrics` — Prometheus-style text; see [METRICS.md](METRICS.md).

---

## Common issues

### Worker unhealthy (503)

1. Check Redis: `docker-compose exec redis redis-cli ping` (expect `PONG`).
2. Check worker logs: `docker-compose logs --tail=50 worker`.
3. Restart worker: `docker-compose restart worker`.

### Web deep health fails (DB or Redis)

1. **Database**: `docker-compose exec postgres pg_isready -U postgres`. If not ready, check postgres logs and disk.
2. **Redis**: same as above.
3. Ensure `DATABASE_URL` and `REDIS_URL` in the web container match the running postgres/redis services (e.g. `postgres:5432`, `redis:6379` inside the compose network).

### High failed jobs

1. Check worker logs for errors (e.g. Twitter rate limit, invalid tokens).
2. Inspect queue: open Bull Board (`docker-compose --profile monitoring up -d` then visit port 3002) or use `npm run queue:status`.
3. Fix or retry failed jobs; consider increasing `WORKER_RATE_LIMIT` or backing off during provider outages.

---

## Escalation

- **Errors in production**: Sentry (if `SENTRY_DSN` is set). Check Sentry for stack traces and release.
- **Uptime / availability**: Point your monitor (UptimeRobot, Better Stack, PagerDuty) at `/api/health` (and optionally `/api/health?deep=1`). Alert on 5xx or timeout.
- **Worker**: Alert on worker `GET /health` returning 503 or on Prometheus metrics (e.g. `worker_queue_failed` above threshold). See [METRICS.md](METRICS.md).

---

## Restarting services

```bash
# Restart only web and worker (no DB/Redis)
docker-compose up -d --no-deps web worker

# Full restart
docker-compose down && docker-compose up -d
```

After code or config changes, run the full deploy script so migrations run and images are rebuilt: `./scripts/deploy-production.sh`.
