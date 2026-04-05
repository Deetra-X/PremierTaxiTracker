# PremierTaxiTracker
Real-Time Three-Wheeler (Tuk-Tuk) Tracking & Movement Logging System for Law Enforcement (Sri Lanka)

## Overview

PremierTaxiTracker is a RESTful web API built for the **Sri Lanka Police** to track and log the movements of registered three-wheelers (tuk-tuks). The API covers the **initial stage** of the system, providing full lifecycle management for vehicles, drivers, GPS location events, and incident alerts.

## Technology Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: SQLite3 (via `better-sqlite3`)
- **Authentication**: JWT (Bearer token)
- **Password hashing**: bcryptjs
- **Testing**: Jest + Supertest

## Getting Started

### Install dependencies

```bash
npm install
```

### Run the server

```bash
npm start
# API available at http://localhost:3000
```

### Run tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Environment variables

| Variable     | Default                           | Description                        |
|--------------|-----------------------------------|------------------------------------|
| `PORT`       | `3000`                            | HTTP port                          |
| `DB_PATH`    | `data/tracker.db`                 | Path to SQLite database file       |
| `JWT_SECRET` | `slp-tracker-dev-secret`          | Secret for signing JWTs            |
| `JWT_EXPIRY` | `8h`                              | JWT expiry duration                |

---

## API Reference

All endpoints (except `POST /api/v1/auth/register` and `POST /api/v1/auth/login`) require a valid Bearer token in the `Authorization` header.

### Health

| Method | Path      | Description    |
|--------|-----------|----------------|
| GET    | `/health` | Health check   |

---

### Authentication – `/api/v1/auth`

| Method | Path                    | Auth required | Description                    |
|--------|-------------------------|---------------|--------------------------------|
| POST   | `/api/v1/auth/register` | No            | Register a new police officer  |
| POST   | `/api/v1/auth/login`    | No            | Login and receive a JWT        |
| GET    | `/api/v1/auth/me`       | Yes           | Get current officer's profile  |

**Register request body**
```json
{ "badge_no": "SLP001", "name": "Officer Silva", "password": "Secret123!", "role": "officer" }
```
`role` is optional (defaults to `"officer"`; use `"admin"` for admin accounts).

**Login request body**
```json
{ "badge_no": "SLP001", "password": "Secret123!" }
```

---

### Vehicles – `/api/v1/vehicles`

| Method | Path                    | Description                        |
|--------|-------------------------|------------------------------------|
| GET    | `/api/v1/vehicles`      | List vehicles (filterable)         |
| POST   | `/api/v1/vehicles`      | Register a new vehicle             |
| GET    | `/api/v1/vehicles/:id`  | Get vehicle details                |
| PUT    | `/api/v1/vehicles/:id`  | Update vehicle                     |
| DELETE | `/api/v1/vehicles/:id`  | Delete vehicle                     |

**Query params (GET list):** `status`, `plate_no`, `page`, `limit`

**Vehicle status values:** `active` | `suspended` | `stolen`

**Create/update body fields:** `plate_no`*, `make`, `model`, `year`, `colour`, `status`

---

### Drivers – `/api/v1/drivers`

| Method | Path                   | Description                        |
|--------|------------------------|------------------------------------|
| GET    | `/api/v1/drivers`      | List drivers (filterable)          |
| POST   | `/api/v1/drivers`      | Register a new driver              |
| GET    | `/api/v1/drivers/:id`  | Get driver details                 |
| PUT    | `/api/v1/drivers/:id`  | Update driver                      |
| DELETE | `/api/v1/drivers/:id`  | Delete driver                      |

**Query params (GET list):** `status`, `nic`, `name`, `page`, `limit`

**Driver status values:** `active` | `suspended`

**Create/update body fields:** `nic`*, `name`*, `licence_no`*, `phone`, `address`, `status`, `vehicle_id`

---

### Locations – `/api/v1/locations`

| Method | Path                                          | Description                            |
|--------|-----------------------------------------------|----------------------------------------|
| POST   | `/api/v1/locations`                           | Submit a GPS location event            |
| GET    | `/api/v1/locations/vehicle/:vehicleId`        | Get movement history for a vehicle     |
| GET    | `/api/v1/locations/vehicle/:vehicleId/latest` | Get the latest location for a vehicle  |

**Submit body fields:** `vehicle_id`*, `latitude`* (−90 to 90), `longitude`* (−180 to 180), `speed` (km/h), `heading` (0–360°)

**History query params:** `from` (ISO8601), `to` (ISO8601), `page`, `limit`

---

### Alerts – `/api/v1/alerts`

| Method | Path                        | Description                         |
|--------|-----------------------------|-------------------------------------|
| GET    | `/api/v1/alerts`            | List alerts (filterable)            |
| POST   | `/api/v1/alerts`            | Raise a new alert/incident          |
| GET    | `/api/v1/alerts/:id`        | Get alert details                   |
| PUT    | `/api/v1/alerts/:id`        | Update alert                        |
| PUT    | `/api/v1/alerts/:id/resolve`| Resolve an alert                    |

**Query params (GET list):** `status`, `type`, `vehicle_id`, `page`, `limit`

**Alert type values:** `stolen` | `suspicious` | `traffic_violation` | `other`

**Alert status values:** `open` | `resolved`

**Create body fields:** `type`*, `vehicle_id`, `driver_id`, `description`, `latitude`, `longitude`

---

## Data Model

```
officers   ──< alerts
vehicles   ──< drivers
vehicles   ──< locations
vehicles   ──< alerts
drivers    ──< alerts
```

- An **officer** raises **alerts**
- A **vehicle** can have many **locations** (GPS events) and **alerts**
- A **driver** is optionally assigned to one **vehicle**

