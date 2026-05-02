# Project Report: Tuk-Tuk Tracking REST API

---

## Table of Contents

1. [Business Requirements Analysis](#1-business-requirements-analysis)
2. [Design](#2-design)
3. [Architecture](#3-architecture)
4. [Implementation](#4-implementation)
5. [Limitations, Scaling, and Further Concerns](#5-limitations-scaling-and-further-concerns)
6. [Appendix](#6-appendix)

---

## 1. Business Requirements Analysis

### 1.1 Background and Stakeholders

Sri Lanka's transport police face a persistent challenge in monitoring the large fleet of tuk-tuks (auto-rickshaws) that operate across provinces, districts, and individual policing stations. These vehicles, often the primary mode of short-haul transport in urban and peri-urban Sri Lanka, are difficult to trace when involved in incidents or when they go missing. The current manual process — recording registration numbers in logbooks and relying on radio communication between stations — is slow, error-prone, and provides no real-time situational awareness.

The primary stakeholders identified during requirements analysis are:

- **HQ Administration (Police HQ):** Requires a national-level view of all vehicles and full administrative authority over system data — users, devices, provinces, districts, and stations.
- **Provincial Officers:** Require a filtered live view and movement history restricted to their province. They should not see vehicles or driver information belonging to other provinces.
- **District Officers:** Similar to provincial officers but scoped to their district only. They must not be able to widen their visibility to province-level by passing alternative query parameters.
- **Station Officers:** The most granular operational role. They may only view vehicles registered to their specific police station.
- **GPS Device Firmware (Machine Client):** Embedded GPS units fitted to tuk-tuks must be able to send periodic location pings to the server without requiring a human-facing JWT login. They need a lightweight, key-based authentication mechanism.

### 1.2 Scope and Feature Set

Through stakeholder discussions the following scope was agreed:

**Core features:**
- A real-time live view endpoint that returns the most recent known GPS coordinates for each active tuk-tuk, filterable by province, district, and station.
- A movement history endpoint that returns a time-ordered log of past GPS pings for one or multiple tuk-tuks, with optional date-range and spatial filters.
- A search endpoint allowing officers to find a specific tuk-tuk by its registration plate number or the driver's name.
- A device ingestion endpoint that accepts GPS pings from fitted hardware units using a pre-assigned API key.
- A complete administrative API for managing provinces, districts, police stations, drivers, GPS devices, tuk-tuk registrations, and system user accounts.
- JWT-based authentication for human users, with role-based access control (RBAC) enforcing the four-tier police hierarchy.

**Security requirements:**
- No officer should be able to view data outside their authorised geographic scope, even by crafting custom query parameters.
- Credentials must never be transmitted or stored in plain text.
- Rate limiting must prevent brute-force attacks on the login endpoint and protect the ingestion endpoint from replay flooding.
- Driver NIC (national identity card) numbers must not be exposed to lower-privilege roles by default.

**Out of scope (first release):**
- A web or mobile frontend dashboard (the API is designed to be consumed by a future frontend).
- WebSocket or server-sent events for push-based live tracking (polling over REST was accepted as sufficient for the initial release).
- Payment or trip-fare management.
- Offline device sync or store-and-forward GPS buffering.

### 1.3 System Objectives

The system must:

1. Accurately record and serve real-time and historical location data for a fleet of GPS-equipped tuk-tuks.
2. Enforce strict geographic access control so that data isolation is guaranteed per organisational unit.
3. Provide a standards-compliant REST API with a machine-readable OpenAPI 3.0 specification and an interactive Swagger UI for developer onboarding.
4. Be deployable to a cloud platform (Render, Railway, or Fly.io) without changes to application code, relying on environment variables for all deployment-time configuration.
5. Support a managed PostgreSQL service (Neon Serverless Postgres was chosen) with TLS-encrypted connections.

---

## 2. Design

### 2.1 Data Model Design

The relational data model reflects Sri Lanka's administrative geography. Provinces contain districts, districts contain police stations, and stations are the leaf nodes to which both tuk-tuks and human users are ultimately anchored. This hierarchy is central to enforcing scope-based access control.

**Key entity relationships:**

```
provinces (1) ──< (many) districts (1) ──< (many) police_stations
police_stations (1) ──< (many) users
police_stations (1) ──< (many) tuk_tuks
tuk_tuks (1) ──< (many) location_logs
tuk_tuks (1) ──(1) gps_devices
tuk_tuks (1) ──(1) drivers
```

The `location_logs` table is intentionally append-only: pings are never deleted or updated, preserving a complete audit trail. The live view is derived from `location_logs` using PostgreSQL's `DISTINCT ON` clause, which selects the most recent log entry per `tuk_tuk_id` in a single efficient query pass.

The `users` table carries a `token_version` integer column. Every time a user's password is reset or their account is administratively revoked, this version increments. JWT tokens embed the version at issue time; the middleware validates the token's embedded version against the current database value on every request, providing instant server-side token revocation without a denylist.

### 2.2 API Design Principles

The API was designed to conform to REST constraints as presented in the module:

**Resource-oriented URLs:** All paths are noun-based and identify resources. For example `/api/admin/tuk-tuks` identifies the tuk-tuk collection, and `/api/admin/tuk-tuks/{tukTukId}` identifies a single vehicle. Action-like sub-paths are used only where unavoidable and follow REST conventions (e.g. `/api/admin/devices/{deviceId}/rotate-key`).

**HTTP verbs used semantically:**
- `GET` for safe, idempotent retrieval of resources.
- `POST` for creating new resources (provinces, tuk-tuks, location pings, etc.).
- `PATCH` for partial updates to existing resources (preferred over `PUT` because none of the update operations require a complete replacement of the resource).

**Uniform response envelope:** All responses from the application return a JSON object with an `ok` boolean field. Success responses include `{ "ok": true, "data": ... }` and error responses include `{ "ok": false, "error": { "code": "...", "message": "..." } }`. This consistency simplifies client-side error handling.

**Conditional GET (HTTP caching):** Selected read endpoints emit a weak `ETag` header computed from a SHA-256 hash of the serialised response body. When a client re-requests the same resource with an `If-None-Match` header matching the previously received ETag, the server returns `304 Not Modified` with an empty body. This eliminates redundant data transfer for frequently polled endpoints. The `Vary: Authorization` header is set on protected endpoints so that intermediate caches never serve one user's data to another.

**Input validation with Zod:** Every request body and query string is validated against a Zod schema before reaching business logic. Validation failures produce a `400` response with a structured `VALIDATION_ERROR` code. This prevents invalid data from ever reaching the database layer.

**Sorting:** Endpoints that return lists (provinces, tuk-tuks, tracking history) accept `sortBy` and `sortOrder` query parameters. Rather than interpolating these directly into SQL — which would create a SQL injection vector — a whitelist-based mapping translates each accepted sort key to a hardcoded SQL column identifier. An invalid `sortBy` value returns a `400` error.

### 2.3 Authentication and Authorisation Design

Two separate authentication mechanisms are used based on the client type:

**JWT for human users:** Officers log in via `POST /api/auth/login` with their email and password. The service validates the credentials against a bcrypt password hash stored in the database, then issues a signed JWT. The JWT payload carries the user's role and a token version counter. Critically, on every subsequent request the JWT middleware re-reads the user's current `is_active`, `token_version`, and `role` from the database rather than trusting the token payload alone. This means compromised tokens or revoked accounts are rejected within one request cycle.

**API key for devices:** GPS units cannot maintain session state or perform a login handshake. Instead, each device is assigned a randomly generated API key stored in the `gps_devices.api_key` column. The device middleware validates the `X-API-Key` header and additionally verifies that the device's `status` is `ACTIVE` before allowing any ping to be recorded.

**Scope enforcement:** The four-tier RBAC model is enforced at the service layer, not only at the middleware level. Even if a user passes a query parameter requesting data outside their authorised scope, the service function detects the mismatch and returns a `403 Forbidden`. For non-HQ roles, the effective query always includes an implicit WHERE clause that pins the results to the user's assigned province, district, or station. This dual-layer approach — middleware checks role existence, service checks scope bounds — prevents privilege escalation through crafted query strings.

---

## 3. Architecture

### 3.1 Layered Module Architecture

The application is structured as a set of vertical modules, each encapsulating a business domain (auth, tracking, device, admin sub-resources). Within each module the code is separated into three horizontal layers:

```
src/
├── routes/          ← Express Router composition
├── modules/
│   ├── <domain>/
│   │   ├── <domain>.routes.js      ← URL patterns and middleware chain
│   │   ├── <domain>.controller.js  ← Request parsing, Zod validation, response shaping
│   │   └── <domain>.service.js     ← Business logic, SQL queries, scope enforcement
├── middleware/      ← Cross-cutting concerns: JWT, RBAC, rate limiting, error handling
├── config/          ← Database connection pool, environment variable loading
├── openapi/         ← OpenAPI 3.0.3 spec built in JavaScript
└── utils/           ← Shared utilities: conditional JSON/ETag, safe ORDER BY builder
```

This separation of concerns means that the controller layer never issues database queries, and the service layer never touches HTTP request or response objects. The benefits are testability (service functions can be called with plain objects), and clarity (adding a new endpoint means touching one file in each layer rather than a single monolithic file).

### 3.2 Technology Choices

**Node.js with ES Modules (ES2022+):** Node 20+ is used throughout with `"type": "module"` in `package.json`. This enables native `import`/`export` syntax, top-level `await` (used in `server.js` for database connection and port binding), and alignment with modern JavaScript standards without a transpilation step.

**Express:** Express 4 is a mature, minimal web framework that aligns with the module's curriculum. Its middleware pipeline model makes it straightforward to compose authentication, rate limiting, and error handling in a predictable order.

**PostgreSQL via `pg` (node-postgres):** A managed relational database was chosen over an in-process SQLite database because the system must support concurrent reads from multiple simultaneous API consumers. Neon Serverless Postgres was selected for deployment because it offers a free tier with TLS-enabled connections and connection pooling, making it a practical choice for a coursework demonstration.

**Zod for validation:** Zod provides a TypeScript-first schema library that works equally well in plain JavaScript. It gives descriptive validation error messages out of the box and integrates cleanly with the Zod v4 API.

**Helmet:** The `helmet` middleware sets security-oriented HTTP response headers (e.g. `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`) with minimal configuration.

**express-rate-limit:** Rate limiters are applied at four levels — global, authentication, device ingestion, and tracking queries. This layered approach ensures that a burst of GPS pings from a device does not consume the global rate limit budget for concurrent human users.

**swagger-ui-express + programmatic OpenAPI spec:** Rather than maintaining a separate YAML file that can fall out of sync with the implementation, the OpenAPI 3.0.3 specification is assembled as a plain JavaScript object in `src/openapi/openapi.js`. This means the spec is always co-located with the code and can reference shared constants. The spec is served by `swagger-ui-express` at `/api/docs`.

### 3.3 Security Architecture

Several security controls were applied in addition to RBAC:

- **bcryptjs with cost factor 10** for password hashing. Plain-text passwords are never stored or logged.
- **JWT hardening:** The issuer (`JWT_ISSUER`) and audience (`JWT_AUDIENCE`) claims are validated on every request. The algorithm is configured via `JWT_ALG` (defaulting to HS256) and the allowed algorithm list is passed explicitly to `jsonwebtoken.verify`, preventing the "none" algorithm attack.
- **Token version revocation:** The `token_version` column on the `users` table allows server-side token invalidation without a denylist. Password resets and administrative deactivation both increment this counter.
- **Privacy controls:** The `LOCATION_PRECISION_DECIMALS` environment variable caps the coordinate precision returned by the API (default 5 decimal places, approximately 1.1 metre resolution) preventing sub-metre tracking of individuals where not required. Driver NIC numbers are excluded from all responses unless `INCLUDE_DRIVER_NIC_IN_RESPONSE=true` is explicitly set for HQ_ADMIN users.
- **CORS default-deny:** The CORS middleware is configured with `origin: false` unless `CORS_ORIGIN` is explicitly set to a comma-separated list of allowed origins. This prevents cross-origin requests from any domain by default.

---

## 4. Implementation

### 4.1 Project Setup and Tooling

The project uses `npm` for dependency management. Dependencies are pinned to minor-version ranges in `package.json` to balance stability with security patch uptake. The `package-lock.json` ensures reproducible installs across environments.

A `.devcontainer/devcontainer.json` is included so that any developer can open the project in a GitHub Codespace or VS Code Dev Container and receive a Node 22 environment with ports pre-forwarded and ESLint pre-installed, without any manual configuration.

Database management is handled by a set of npm scripts wrapping standalone Node.js scripts in the `scripts/` directory. These cover schema application (`db:apply`), connection health check (`db:check`), device API key backfill (`db:device-keys`), password setting (`db:set-password`), and incremental schema migrations (`db:migrate-station`, `db:migrate-security`). Keeping migrations as discrete named scripts — rather than a migration framework — was a deliberate choice for simplicity appropriate to the project scale.

### 4.2 Key Implementation Decisions

**Port autodiscovery:** The server attempts to bind on `PORT` (defaulting to 3000) and, if the port is in use, automatically increments and retries up to 20 times. This allows multiple instances to run on the same development machine without manual port configuration.

**Conditional GET implementation:** `src/utils/httpConditionalJson.js` is a utility that serialises any JavaScript object, computes a 32-character base64url-encoded SHA-256 hash, and wraps it in a weak ETag. On receiving a request with `If-None-Match` matching the computed ETag, it returns `304` without re-sending the body. This utility is used on the `/health` endpoint (with public `Cache-Control`) and on authenticated collection endpoints (with `private` cache semantics and `Vary: Authorization`).

**Safe ORDER BY construction:** `src/utils/sqlOrderBy.js` builds a parameterised `ORDER BY` clause from a caller-supplied whitelist map. Because PostgreSQL does not support parameterised column identifiers — only parameterised values — any approach that interpolates a user-supplied sort field directly into SQL is a SQL injection risk. The whitelist approach resolves this by mapping each accepted sort key (e.g. `"recordedAt"`) to its hardcoded SQL counterpart (e.g. `"ll.recorded_at"`), and rejecting any value not present in the map.

**Scope-aware query construction:** In the tracking service, scope enforcement and SQL construction are interleaved. The service first validates that any filters requested by the client are within the authenticated user's scope (using `assertRequestedScopeWithinUserScope`), then computes the effective scope that must be applied (using `withEffectiveScope`), and finally appends the scope filter as a parameterised WHERE clause predicate. This three-step pattern ensures that a DISTRICT_OFFICER cannot observe data from a neighbouring district even if they manually supply a `districtId` query parameter matching another district.

**Error middleware:** A single `apiErrorHandler` middleware is registered last in the Express application. Service functions and middleware raise errors using `createHttpError`, which attaches a numeric `status` and a string `code` to a standard `Error` object. The error handler reads these properties and responds with the uniform `{ ok: false, error: { code, message } }` envelope. Internal server errors (`status >= 500`) log the full error to the console but return a generic `"Internal server error"` message to the client, preventing stack traces from leaking to API consumers.

### 4.3 Testing

A lightweight smoke test suite is located in `tests/api-security.test.js`. It uses Node.js's built-in `node:test` runner and `supertest` to create an in-process HTTP server and issue requests without a live database connection (the database is not required for these tests because they focus on HTTP-layer behaviour).

The tests cover:
- Conditional GET on `/health` — verifies that the ETag is returned on the first response and that a subsequent request with the correct `If-None-Match` header receives a `304`.
- JWT protection — verifies that `/api/tracking/live` without an `Authorization` header returns `401`, and that a malformed token also returns `401`.
- Global rate limiting — uses the `TEST_GLOBAL_RATE_LIMIT` environment variable to set a low limit (5 requests), exhausts it, and asserts that the next request receives `429 Too Many Requests`.

### 4.4 Simulation Data

A `simulation-data.json` file is included in the repository root. It contains realistic seed data structured around Sri Lanka's geography and the system's data model:

- **3 provinces** (Western, Central, Southern)
- **7 districts** across those provinces
- **8 police stations** across those districts
- **10 drivers** with realistic NIC numbers, phone numbers, and licences
- **10 GPS devices** (8 active, 1 in maintenance, 1 inactive)
- **10 tuk-tuks** (8 active, 2 inactive), each linked to a driver, device, province, district, and station
- **7 user accounts** covering all four roles (HQ_ADMIN, PROVINCIAL_OFFICER, DISTRICT_OFFICER, STATION_OFFICER)
- **30 location log entries** representing realistic movement traces across Colombo, Negombo, Kalutara, Kandy, Matale, Galle, and Matara
- **Sample API request bodies** for login, device ping ingestion, and administrative CRUD operations

---

## 5. Limitations, Scaling, and Further Concerns

### 5.1 Current Limitations

**No real-time push mechanism:** The current design uses a polling model where clients must periodically re-issue `GET /api/tracking/live` to receive updated positions. For a live dashboard with many concurrent viewers polling every few seconds, this generates significant read load. A WebSocket or server-sent events (SSE) channel would be more efficient, but was deferred to avoid scope creep.

**No pagination on list endpoints:** Several `GET` endpoints (drivers, stations, tuk-tuks, history) return all matching rows up to a hardcoded limit (`LIMIT 1000` for live view, `LIMIT 5000` for history). For a national-scale deployment with tens of thousands of tuk-tuks, these limits would need to be replaced by cursor-based or offset-based pagination with `limit` and `offset` query parameters.

**In-memory rate limiting:** `express-rate-limit` stores counters in the process's memory by default. If the API is deployed across multiple Node.js processes (horizontal scaling), each process maintains independent counters, making the configured limits effectively multiplied by the number of instances. A Redis-backed store (e.g. `rate-limit-redis`) would centralise these counters.

**No refresh token mechanism:** JWT access tokens expire after one hour (`JWT_EXPIRES_IN=1h`). Clients must re-authenticate with the login endpoint when the token expires. A refresh token pattern would improve the user experience for long-running dashboard sessions.

**Location history is never pruned:** The `location_logs` table is append-only with no archival strategy. At a ping frequency of once per minute per device, a fleet of 1,000 active tuk-tuks would accumulate approximately 1.44 million rows per day. Without a retention policy (e.g. partition pruning or a background archival job), query performance will degrade over months.

**Swagger UI access in production:** The OpenAPI documentation is disabled by default in production and requires both `ENABLE_API_DOCS=true` and `PUBLIC_API_DOCS=true` to be publicly accessible. While this is a reasonable default for a real deployment, it means evaluators need to set these environment variables explicitly to view the live Swagger UI.

### 5.2 Scaling Considerations

**Horizontal scaling:** The API is stateless beyond the database connection pool. All shared state (users, tokens, location logs) lives in PostgreSQL. This means the application can be horizontally scaled behind a load balancer with minimal changes. The primary requirement is replacing in-memory rate limiters with a shared Redis store, and ensuring the database connection pool size is configured appropriately for the number of instances.

**Read replicas for tracking queries:** The live view and history endpoints are read-only. As fleet size grows, these queries — particularly `DISTINCT ON (tuk_tuk_id) ORDER BY recorded_at DESC` over a growing `location_logs` table — will benefit from directing reads to a PostgreSQL read replica while writes (device pings) continue to the primary.

**Index strategy:** For production scale, the `location_logs` table needs at minimum an index on `(tuk_tuk_id, recorded_at DESC)` to support the live view query efficiently, and an index on `recorded_at` for history range queries. Tuk-tuks' `station_id`, `district_id`, and `province_id` columns would similarly benefit from indexes to support JOIN filtering.

**Database connection pooling:** The current configuration uses a single `pg.Pool` per process. For serverless or high-concurrency deployments, an external connection pooler such as PgBouncer or Neon's built-in connection pooling should be placed in front of the database to prevent connection exhaustion.

### 5.3 Further Concerns

**Data privacy and GDPR-equivalent compliance:** The system stores GPS coordinates linked to registered drivers, which constitutes personal location data under Sri Lanka's Personal Data Protection Act (2022). Production deployments must have a documented data retention and deletion policy, and must not expose NIC numbers in API responses without a legitimate legal basis.

**Audit logging:** At present there is no audit trail of which officer queried which data or which administrator made configuration changes. A production system handling sensitive location data should maintain an immutable audit log.

**Device security:** The current device API key is a static secret stored in the database. If a device is physically compromised, the key should be rotated immediately using `POST /api/admin/devices/{deviceId}/rotate-key`. A more robust approach would be to use mutual TLS (mTLS) between the device and the server, eliminating static key management entirely.

**HTTPS enforcement:** The application code itself serves HTTP; HTTPS termination is delegated to the deployment platform's reverse proxy. This is a standard and acceptable pattern for cloud deployments, but must be explicitly verified to be in place — traffic must never traverse the public internet unencrypted.

---

## 6. Appendix

### 6.1 Deployment Details

#### A. URL of the Deployed API

The API is deployed to Render at:

**https://premier-taxi-tracker.onrender.com**

The health check endpoint is publicly accessible at:

**https://premier-taxi-tracker.onrender.com/health**

Interactive Swagger documentation (enabled for coursework evaluation) is available at:

**https://premier-taxi-tracker.onrender.com/api/docs**

#### B. API Specification (Swagger / OpenAPI)

The OpenAPI 3.0.3 specification JSON is served at:

**https://premier-taxi-tracker.onrender.com/api/openapi.json**

The interactive Swagger UI (requires `ENABLE_API_DOCS=true` and `PUBLIC_API_DOCS=true` on the deployment) is at:

**https://premier-taxi-tracker.onrender.com/api/docs/**

The specification is also maintained programmatically within the repository at `src/openapi/openapi.js` and covers all endpoints including request/response schemas, security schemes (`bearerAuth` and `deviceApiKey`), and parameter documentation.

**Summary of API endpoints documented in the specification:**

| Tag | Method | Path | Auth | Description |
|-----|--------|------|------|-------------|
| Health | GET | `/health` | None | Health check with conditional ETag |
| Auth | POST | `/api/auth/login` | None | Login, returns JWT |
| Tracking | GET | `/api/tracking/live` | JWT | Live tuk-tuk positions |
| Tracking | GET | `/api/tracking/live-search` | JWT | Search by plate/driver name |
| Tracking | GET | `/api/tracking/history` | JWT | Movement log, filterable |
| Tracking | GET | `/api/tracking/history/{tukTukId}` | JWT | Per-vehicle movement log |
| Device | POST | `/api/device/pings` | API Key | Ingest GPS ping from device |
| Admin | GET/POST | `/api/admin/provinces` | JWT (HQ/Provincial) | List / create provinces |
| Admin | PATCH | `/api/admin/provinces/{provinceId}` | JWT (HQ only) | Update province |
| Admin | GET/POST | `/api/admin/districts` | JWT | List / create districts |
| Admin | PATCH | `/api/admin/districts/{districtId}` | JWT | Update district |
| Admin | GET/POST | `/api/admin/stations` | JWT | List / create stations |
| Admin | PATCH | `/api/admin/stations/{stationId}` | JWT | Update station |
| Admin | GET/POST | `/api/admin/drivers` | JWT | List / create drivers |
| Admin | PATCH | `/api/admin/drivers/{driverId}` | JWT | Update driver |
| Admin | GET/POST | `/api/admin/devices` | JWT | List / create GPS devices |
| Admin | PATCH | `/api/admin/devices/{deviceId}` | JWT | Update GPS device |
| Admin | POST | `/api/admin/devices/{deviceId}/rotate-key` | JWT | Rotate device API key |
| Admin | GET/POST | `/api/admin/tuk-tuks` | JWT | List / create tuk-tuks |
| Admin | PATCH | `/api/admin/tuk-tuks/{tukTukId}` | JWT | Update tuk-tuk |
| Admin | GET/POST | `/api/admin/users` | JWT | List / create users |
| Admin | PATCH | `/api/admin/users/{userId}` | JWT | Update user |
| Admin | POST | `/api/admin/users/{userId}/reset-password` | JWT (HQ only) | Reset user password |

#### C. URLs of GitHub Repositories

The source code repository is publicly available at:

**https://github.com/Deetra-X/PremierTaxiTracker**

The repository contains:
- Full application source code (`src/`)
- Database management scripts (`scripts/`)
- Simulation data (`simulation-data.json`)
- Automated smoke tests (`tests/`)
- This project report (`report.md`)
- Environment variable reference (`.env.example`)
- Dev container configuration (`.devcontainer/`)

#### D. AI Assistance

GitHub Copilot (integrated in VS Code) was used during development for autocomplete suggestions while writing repetitive Zod schema blocks, SQL query construction, and OpenAPI path object definitions. All AI-generated suggestions were reviewed, modified, and tested before being committed. No AI tool was used to generate the overall architecture, security model, or RBAC scope logic — those were designed manually.

No AI prompt-sharing or external AI coding session URLs exist, as the assistance was provided inline through the IDE's autocomplete feature rather than through a chat interface.

---

*Report prepared for the RESTful API module coursework, May 2026.*
