# Database migrations

Migrations are owned by the FastAPI backend and managed with Alembic in
`backend/alembic/`. The initial Alembic revision is a baseline of the
pre-separation PostgreSQL schema; future schema evolution should happen only
through backend Alembic revisions.

## Running migrations

Production migrations run through the root Docker Compose `migrate` service:

```bash
./scripts/run-migrations.sh
```

The script loads `.env.production` or `.env.local` when present, starts the
Compose `postgres` dependency, builds the migration image, and runs:

```bash
alembic upgrade head
```

The production deploy script also runs migrations indirectly because
`docker-compose.yml` wires `backend` to depend on the one-off `migrate` service
completing successfully.

For local host-Python development, you can still run Alembic directly:

```bash
cd backend
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5444/socialposter \
  alembic upgrade head
```

## Creating migrations

After changing SQLAlchemy models in `backend/app/infrastructure/db/models.py`:

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

Review generated SQL carefully before committing.
