# Tuk-Tuk API

REST API for real-time tuk-tuk tracking and movement logging (Neon Postgres + Express).

## Quick start (local)

Prereqs: Node.js 20+ and a Postgres database (Neon recommended).

1. Install deps

```bash
npm install
```

2. Create `.env` from `.env.example`

```bash
copy .env.example .env
```

3. Fill these variables in `.env`

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT` (optional)
- `JWT_ISSUER` (recommended)
- `JWT_AUDIENCE` (recommended)

4. Apply DB schema + seed data

```bash
npm run db:apply
```

If upgrading an existing DB, run:

```bash
npm run db:migrate-security
```

5. Run the API

```bash
npm run dev
```

## Docs

- Swagger UI: `/api/docs/` (disabled by default in production; HQ_ADMIN-only if enabled)
- OpenAPI JSON: `/api/openapi.json` (disabled by default in production; HQ_ADMIN-only if enabled)

Control with `ENABLE_API_DOCS`.

## Scripts

- `npm run db:check`: DB connection smoke test
- `npm run db:apply`: apply schema file to DB (set `RESET_DB=1` to include DROP statements)
- `npm run db:tables`: list public tables
- `npm run db:device-keys`: ensure/backfill `gps_devices.api_key`
- `npm run db:set-password`: set bcrypt password for a user

## Auth

### Police/admin users (JWT)

1. `POST /api/auth/login`
2. Use `Authorization: Bearer <token>` on protected routes

JWT hardening env vars:

- `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ALG`
- `JWT_EXPIRES_IN` (default `1h`)

### Device client (API key)

Use `X-API-Key: <gps_devices.api_key>` on:
- `POST /api/device/pings`

## Deployment + HTTPS

Recommended: deploy to a platform like Render/Railway/Fly.

- HTTPS is handled by the platform/proxy (TLS termination).
- The app should listen on `process.env.PORT` (already supported in `src/server.js`).

