# Runbook — shitposter production

## Logs

- **All services**: `docker compose logs -f`
- **Frontend**: `docker compose logs -f web`
- **Backend**: `docker compose logs -f backend`
- **Worker**: `docker compose logs -f backend-worker`

Set `LOG_LEVEL` on the backend to `debug`, `info`, `warn`, or `error`.

## Health endpoints

- **Frontend process**: `GET /`
- **Backend lightweight**: `GET /api/v1/health`
- **Backend deep**: `GET /api/v1/health?deep=1` checks PostgreSQL and Redis.
- **Backend ready**: `GET /api/v1/health/ready`

The Python worker is an ARQ worker. It should be supervised by Docker Compose; inspect
`backend-worker` logs for job failures.

---

## Common issues

### Backend unhealthy (503)

1. Check DB: `docker compose exec postgres pg_isready -U postgres`.
2. Check Redis: `docker compose exec redis redis-cli ping`.
3. Check backend logs: `docker compose logs --tail=100 backend`.

### Worker errors

1. Check `docker compose logs --tail=100 backend-worker`.
2. Verify `REDIS_URL`, `DATABASE_URL`, and `TOKEN_ENCRYPTION_KEY`.
3. Inspect failed `post_target` rows in PostgreSQL for provider error messages.

---

## Escalation

- **Errors in production**: Sentry (if `SENTRY_DSN` is set). Check Sentry for stack traces and release.
- **Uptime / availability**: Point your monitor (UptimeRobot, Better Stack, PagerDuty) at the backend `/api/v1/health` endpoint (and optionally `/api/v1/health?deep=1`). Alert on 5xx or timeout.
- **Worker**: Alert on `backend-worker` crashes/restarts and ARQ queue depth. See [METRICS.md](METRICS.md).

---

## Restarting services

```bash
docker compose up -d --no-deps web backend backend-worker

docker compose down && docker compose up -d
```

After code or config changes, run `./scripts/deploy-production.sh`.
