# Metrics and alerting

## Backend and worker metrics

The FastAPI backend owns operational endpoints:

- `GET http://localhost:8000/api/v1/health`
- `GET http://localhost:8000/api/v1/health?deep=1`
- `GET http://localhost:8000/api/v1/health/ready`

The legacy Node worker metrics endpoint was removed with the BullMQ worker.
The Python worker now runs as an ARQ worker process; monitor its container
health/logs and Redis queue keys until a dedicated exporter is added.

### Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `worker_jobs_processed_total` | counter | Total jobs processed successfully |
| `worker_jobs_failed_total` | counter | Total jobs failed |
| `worker_queue_waiting` | gauge | Jobs in wait state |
| `worker_queue_active` | gauge | Jobs currently processing |
| `worker_queue_failed` | gauge | Jobs in failed state |
| `worker_queue_delayed` | gauge | Jobs scheduled for later |
| `worker_uptime_seconds` | gauge | Worker process uptime in seconds |

### Scrape config (Prometheus)

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: shitposter-worker
    static_configs:
      - targets: ["localhost:8000"]
    metrics_path: /api/v1/health
    scrape_interval: 15s
```

If the app is behind a reverse proxy, expose the worker metrics path or scrape from the same network (e.g. Docker network).

---

## Example alerts

Adjust thresholds to your needs.

### Backend unhealthy

- **Condition**: Backend deep health returns 503 or is down.
- **Action**: Alert and check Redis, then worker logs (see [RUNBOOK.md](RUNBOOK.md)).

### Too many failed jobs

- **Condition**: `worker_queue_failed > 10` (or `worker_jobs_failed_total` increasing fast).
- **Action**: Check worker logs and Sentry; may be provider rate limits or bad credentials.

### Redis disconnected

- **Condition**: Worker health payload has `"redis": "disconnected"`.
- **Action**: Check Redis container and connectivity; restart worker if needed.

### Ready probe failing

- **Condition**: Backend `/api/v1/health/ready` returns non-200.
- **Action**: Worker may be shutting down or stuck; check logs and restart.

---

## Web app

The Next.js frontend no longer exposes backend health. Use:

- **Sentry** for errors and performance (if configured).
- **Uptime / deep health**: Monitor the FastAPI backend health endpoints with your preferred uptime tool and alert on 5xx or timeout.
