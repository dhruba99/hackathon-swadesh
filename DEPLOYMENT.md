# Deployment Guide

This project has two deployable parts:

- A `Next.js` frontend
- A `Hono` API server

It also depends on:

- PostgreSQL
- S3-compatible object storage

## Recommended Deployment Options

### Frontend

- Vercel
- Netlify with a compatible Node setup
- Any Node host that can run `next build` and `next start`

### API

- Render
- Railway
- Fly.io
- AWS ECS or App Runner
- Any container-friendly Node platform

### Database

- Neon
- Supabase Postgres
- Railway Postgres
- Render Postgres
- AWS RDS

### Object Storage

- AWS S3
- Cloudflare R2
- MinIO
- Backblaze B2 with S3 compatibility

## Required Environment Variables

```text
NEXT_PUBLIC_UPLOAD_ENDPOINT
PORT
CORS_ORIGINS
DATABASE_URL
S3_ENDPOINT
S3_REGION
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_BUCKET
S3_FORCE_PATH_STYLE
```

## Example Production Shape

### Frontend

- Build command: `npm run build`
- Start command: `npm run start:client`

### API

- Start command: `npm run start:server`

### Database

- Use a managed PostgreSQL instance
- Point `DATABASE_URL` to the managed database

### Storage

- Create a bucket for uploaded audio chunks
- Use least-privilege credentials
- Store secrets in the deployment platform secret manager

## Deployment Notes

- Set `NEXT_PUBLIC_UPLOAD_ENDPOINT` to the deployed API URL
- Make sure the API CORS allowlist includes the deployed frontend origin
- Rotate any credentials previously used in local development
- Enable HTTPS in production
- Consider rate limiting and authentication before public launch

## Suggested Production Improvements

- Add authentication
- Add request logging and monitoring
- Add upload session metadata and cleanup workflows
- Add tests around the upload route and retry behavior
