# Project Description

## One-Line GitHub Description

Fault-tolerant audio upload demo built with Next.js, Hono, PostgreSQL, Docker, and S3, featuring OPFS persistence, retries, and idempotent chunk ingestion.

## Short Recruiter Summary

This project is a full-stack TypeScript application that focuses on reliability in real-world upload workflows. It records audio in the browser, stores chunks locally with OPFS, retries uploads in the background with a Web Worker, and uses a Hono plus PostgreSQL backend to guarantee idempotent chunk handling before writing objects to S3-compatible storage.

## Resume-Friendly Version

Built a fault-tolerant audio ingestion demo with Next.js, Hono, PostgreSQL, Docker, and AWS S3, using Web Workers, OPFS persistence, checksum validation, and idempotent chunk processing to handle unreliable networks and duplicate upload requests.

## What Makes It Strong for Review

- Shows end-to-end product thinking, not just UI work
- Demonstrates browser APIs beyond standard form handling
- Highlights backend correctness through deduplication and integrity checks
- Communicates practical system design under failure conditions
