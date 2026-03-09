# Metrics and alerting

## Worker Prometheus metrics

The worker exposes Prometheus-style metrics at **GET http://localhost:3001/metrics** (or the host/port where the worker health server is reachable).

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
      - targets: ["localhost:3001"]  # or your worker host
    metrics_path: /metrics
    scrape_interval: 15s
```

If the app is behind a reverse proxy, expose the worker metrics path or scrape from the same network (e.g. Docker network).

---

## Example alerts

Adjust thresholds to your needs.

### Worker unhealthy

- **Condition**: Worker `/health` returns 503 or is down.
- **Action**: Alert and check Redis, then worker logs (see [RUNBOOK.md](RUNBOOK.md)).

### Too many failed jobs

- **Condition**: `worker_queue_failed > 10` (or `worker_jobs_failed_total` increasing fast).
- **Action**: Check worker logs and Sentry; may be provider rate limits or bad credentials.

### Redis disconnected

- **Condition**: Worker health payload has `"redis": "disconnected"`.
- **Action**: Check Redis container and connectivity; restart worker if needed.

### Ready probe failing

- **Condition**: Worker `/ready` returns non-200 (e.g. for Kubernetes readiness).
- **Action**: Worker may be shutting down or stuck; check logs and restart.

---

## Web app

The Next.js app does not expose Prometheus metrics. Use:

- **Sentry** for errors and performance (if configured).
- **Uptime / deep health**: Monitor `GET /api/health` and `GET /api/health?deep=1` with your preferred uptime tool and alert on 5xx or timeout.
