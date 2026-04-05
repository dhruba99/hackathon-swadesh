# Local Run

## Services

- Next.js client: `http://localhost:3012`
- Hono API: `http://localhost:3011/api/upload`
- PostgreSQL: `localhost:5432`

## Start PostgreSQL

```powershell
docker compose up -d postgres
```

## Current local database URL

```text
postgresql://postgres:postgres@localhost:5432/audio_uploads
```

The `chunks` table is created automatically from `docker/postgres/init/001-create-chunks.sql` when the Postgres container initializes.
