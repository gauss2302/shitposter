# Shitposter Backend

FastAPI backend service for Shitposter. The backend owns server-side concerns
that previously lived in Next.js route handlers: authentication, database
access, OAuth/social integrations, billing, post scheduling, and worker jobs.

## Local development

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Health check:

```bash
curl http://localhost:8000/api/v1/health
```
