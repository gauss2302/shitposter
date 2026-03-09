# Database migrations

## Overview

Migrations are managed with [Drizzle ORM](https://orm.drizzle.team/) and live in `drizzle/`. They are run **before** deploying the app or worker, not from inside containers.

## Running migrations

### Local / dev

```bash
# Ensure DATABASE_URL is set (e.g. in .env.local)
npm run db:migrate
```

### Production / VPS

1. Set `DATABASE_URL` (e.g. in `.env.production` or export).
2. Run migrations **before** starting or updating containers:

   ```bash
   ./scripts/run-migrations.sh
   ```

   Or with npm (env must already be set):

   ```bash
   npm run db:migrate
   ```

The deploy script `scripts/deploy-production.sh` runs migrations automatically as step 2.

### Drizzle config and env

- `drizzle.config.ts` loads env in this order:
  - If `DATABASE_URL` is already set, it is used.
  - Otherwise it tries `.env.production`, then `.env.local`.
- CI or headless environments can set `DATABASE_URL` in the environment and run `npm run db:migrate` without any `.env` file.

## Creating migrations

After changing `lib/db/schema.ts`:

```bash
npm run db:generate
# Review generated SQL in drizzle/*.sql, then:
npm run db:migrate
```

Do not edit existing migration files; add new ones for further changes.

## Rollback

Drizzle does not generate down migrations. To roll back:

1. **Before migrating**: Take a DB backup (e.g. `pg_dump`). The deploy script has an optional backup step you can enable.
2. **If a migration breaks**: Restore from backup, fix the migration (or add a new corrective migration), then re-run.

Example backup before migrate:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M%S).sql
./scripts/run-migrations.sh
```
