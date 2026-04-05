# Contributing

Thanks for your interest in contributing.

## Getting Started

1. Fork the repository
2. Create a feature branch
3. Copy `.env.example` to `.env.local`
4. Start PostgreSQL with Docker
5. Run the app locally and verify your change

## Development Commands

```powershell
npm install
docker compose up -d postgres
npm run dev
```

## Pull Request Guidelines

- Keep changes focused and easy to review
- Update docs when behavior or setup changes
- Avoid committing secrets, local env files, logs, or build artifacts
- Include reproduction steps for bug fixes

## Reporting Issues

When opening an issue, include:

- Expected behavior
- Actual behavior
- Steps to reproduce
- Relevant logs or screenshots
- Browser and OS details if the issue is client-side
