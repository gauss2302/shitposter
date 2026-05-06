# Database migrations

Migrations are now owned by the FastAPI backend and managed with Alembic in
`backend/alembic/`. The historical Drizzle migrations remain in `drizzle/` as
the record of the schema the Python baseline mirrors.

## Running migrations

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5444/socialposter \
  ./scripts/run-migrations.sh
```

The production deploy script runs this before restarting services.

## Creating migrations

After changing SQLAlchemy models in `backend/app/infrastructure/db/models.py`:

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

Review generated SQL carefully before committing.
