# Fault-Tolerant Audio Upload Demo

A portfolio-ready full-stack demo that records audio in the browser, stores chunks locally for resilience, and uploads them to object storage through an idempotent backend.

This project is designed to show practical engineering decisions rather than just a happy-path upload form. It demonstrates how to build a recording workflow that can tolerate flaky networks, browser refreshes, duplicate requests, and interrupted uploads without losing track of chunk state.

## Recruiter Summary

This project demonstrates:

- Full-stack TypeScript development with React, Next.js, Hono, PostgreSQL, and AWS S3
- Resilient client-side systems using Web Workers and Origin Private File System (OPFS)
- Idempotent backend design for duplicate-safe chunk ingestion
- Integrity checks using SHA-256 checksums and object metadata verification
- Practical local development workflow with Docker-backed PostgreSQL

If you are reviewing this as a hiring signal, the emphasis is on reliability, state recovery, and system design under imperfect network conditions.

## What It Does

The application records 5-second audio chunks in the browser and processes them through a fault-tolerant upload pipeline:

1. Audio is captured with `MediaRecorder`
2. Each chunk is hashed with SHA-256
3. The chunk is written to OPFS so it survives page reloads
4. A Web Worker manages upload concurrency and retries
5. The backend records chunk state in PostgreSQL
6. The chunk is uploaded to S3-compatible storage
7. The backend verifies uploaded object metadata and content length

## Technical Highlights

- `Next.js` client for the browser UI
- `Web Worker` for background upload orchestration
- `OPFS` for persistent browser-side chunk storage
- `Hono` API server for chunk ingestion
- `PostgreSQL` for chunk metadata and idempotency tracking
- `Drizzle ORM` for typed database access
- `AWS SDK v3` for object storage uploads
- `Docker Compose` for local PostgreSQL setup

## Project Structure

```text
app/                     Next.js app entrypoints
client/                  Browser UI, worker, queue, uploader, OPFS logic
server/                  Hono API, database, schema, storage integration
docker/postgres/init/    Database bootstrap SQL
docker-compose.yml       Local PostgreSQL service
```

## Local Development

### Prerequisites

- Node.js 20+
- npm
- Docker Desktop

### Environment Setup

1. Create a local env file:

```powershell
Copy-Item .env.example .env.local
```

2. Fill in the S3 settings in `.env.local`

Required environment variables:

- `NEXT_PUBLIC_UPLOAD_ENDPOINT`
- `PORT`
- `DATABASE_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `S3_FORCE_PATH_STYLE`

### Install Dependencies

```powershell
npm install
```

### Start PostgreSQL with Docker

```powershell
docker compose up -d postgres
```

The default local database URL is:

```text
postgresql://postgres:postgres@localhost:5432/audio_uploads
```

### Start the App

Run the client and server together:

```powershell
npm run dev
```

Or run them separately:

```powershell
npm run dev:client
npm run dev:server
```

### Local URLs

- Client: `http://localhost:3012`
- API: `http://localhost:3011/api/upload`
- PostgreSQL: `localhost:5432`

## How the Reliability Model Works

### Client Side

- Chunks are persisted locally before upload
- Upload work is handled off the main thread in a Web Worker
- Failed uploads are retried with backoff
- Pending chunks can be restored after reload

### Server Side

- Each chunk is identified by session and index
- Duplicate inserts are handled safely through unique constraints
- Existing uploaded chunks return success without double-writing
- Uploaded object metadata is verified before the database is finalized

## Database

The `chunks` table stores:

- `sessionId`
- `chunkIndex`
- `checksum`
- `storageKey`
- `etag`
- `status`

The local PostgreSQL container initializes the table automatically from:

`docker/postgres/init/001-create-chunks.sql`

## Suggested Production Deployment

This repository is optimized for local development and demonstration. For production, a clean deployment path would be:

- Deploy the Next.js frontend to Vercel or a Node host
- Deploy the Hono API to a Node server, container platform, or serverless runtime
- Use managed PostgreSQL
- Use S3 or S3-compatible object storage
- Store secrets in the platform secret manager rather than env files in source control

## Publishing to GitHub

Before pushing this project publicly:

- Make sure `.env.local` is not committed
- Use placeholder values in `.env.example`
- Rotate any cloud credentials that were ever stored in local source files
- Remove any local-only logs or build artifacts

## Why This Project Matters

A lot of demo apps work only when the network is perfect. This one is intentionally built around failure handling. It shows how to think about data durability, retry behavior, idempotency, and user experience when uploads are long-running and interruptions are expected.

## License

Add a license here before publishing if you want recruiters and reviewers to know how the code may be used.
