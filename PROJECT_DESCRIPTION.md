# Project Description

## One-Line GitHub Description

Fault-tolerant audio upload demo built with Next.js, Hono, PostgreSQL, Docker, and S3, featuring OPFS persistence, retries, and idempotent chunk ingestion.

## Short Recruiter Summary

This project is a full-stack TypeScript application that focuses on reliability in real-world upload workflows. It records audio in the browser, stores chunks locally with OPFS, retries uploads in the background with a Web Worker, and uses a Hono plus PostgreSQL backend to guarantee idempotent chunk handling before writing objects to S3-compatible storage.

## Resume-Friendly Version

Built a fault-tolerant audio ingestion demo with Next.js, Hono, PostgreSQL, Docker, and AWS S3, using Web Workers, OPFS persistence, checksum validation, and idempotent chunk processing to handle unreliable networks and duplicate upload requests.

## GitHub About Section

Fault-tolerant audio upload demo with Next.js, Hono, Postgres, Docker, OPFS, and S3.

## Pinned Project Text

Built to demonstrate resilient upload architecture under real-world network conditions. The app records audio in 5-second chunks, persists work locally in OPFS, retries uploads through a Web Worker, and uses an idempotent Hono plus PostgreSQL backend before storing verified objects in S3-compatible storage.

## What Makes It Strong for Review

- Shows end-to-end product thinking, not just UI work
- Demonstrates browser APIs beyond standard form handling
- Highlights backend correctness through deduplication and integrity checks
- Communicates practical system design under failure conditions
