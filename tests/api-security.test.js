/**
 * JWT protection + rate limiting smoke tests.
 * Run: npm test
 *
 * Uses TEST_GLOBAL_RATE_LIMIT so rate-limit assertions stay fast without changing production defaults.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TEST_GLOBAL_RATE_LIMIT = "5";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "unit-test-jwt-secret-at-least-32-characters-long";
}

const request = (await import("supertest")).default;
const jwt = (await import("jsonwebtoken")).default;
const { createApp } = await import("../src/app.js");
const { getHistory } = await import("../src/modules/tracking/tracking.service.js");
const { pool } = await import("../src/config/db.js");

test("GET /health returns ETag and 304 when If-None-Match matches", async () => {
  const app = createApp();
  const first = await request(app).get("/health");
  assert.equal(first.status, 200);
  const etag = first.headers.etag;
  assert.ok(etag);
  const second = await request(app).get("/health").set("If-None-Match", etag);
  assert.equal(second.status, 304);
});

test("GET /api/tracking/live without Authorization returns 401", async () => {
  const app = createApp();
  const res = await request(app).get("/api/tracking/live");
  assert.equal(res.status, 401);
  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.error?.code, "UNAUTHORIZED");
});

test("GET /api/tracking/live with invalid Bearer token returns 401", async () => {
  const app = createApp();
  const res = await request(app)
    .get("/api/tracking/live")
    .set("Authorization", "Bearer not.a.valid.jwt");
  assert.equal(res.status, 401);
  assert.equal(res.body?.error?.code, "UNAUTHORIZED");
});

test("global rate limit returns 429 after TEST_GLOBAL_RATE_LIMIT requests to /health", async () => {
  const app = createApp();
  const limit = parseInt(process.env.TEST_GLOBAL_RATE_LIMIT ?? "5", 10);

  for (let i = 0; i < limit; i++) {
    const res = await request(app).get("/health");
    assert.equal(res.status, 200, `expected 200 on request ${i + 1}`);
  }

  const blocked = await request(app).get("/health");
  assert.equal(blocked.status, 429);
});

test("admin driver and device routes require HQ role", async () => {
  const app = createApp();
  const originalQuery = pool.query;
  const token = jwt.sign(
    { sub: "7", ver: 0 },
    process.env.JWT_SECRET,
    {
      issuer: "tuk-tuk-api",
      audience: "tuk-tuk-web",
      algorithm: "HS256"
    }
  );

  pool.query = async (sql, params) => {
    if (sql.includes("from users where user_id = $1")) {
      assert.deepEqual(params, [7]);
      return {
        rowCount: 1,
        rows: [
          {
            user_id: 7,
            station_id: 11,
            role: "PROVINCIAL_OFFICER",
            is_active: true,
            token_version: 0
          }
        ]
      };
    }
    if (sql.includes("from police_stations ps")) {
      assert.deepEqual(params, [11]);
      return {
        rowCount: 1,
        rows: [{ station_id: 11, district_id: 22, province_id: 33 }]
      };
    }
    throw new Error(`unexpected query: ${sql}`);
  };

  try {
    const provincialDrivers = await request(app)
      .get("/api/admin/drivers")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(provincialDrivers.status, 403);

    const provincialDevices = await request(app)
      .post("/api/admin/devices/1/rotate-key")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(provincialDevices.status, 403);
  } finally {
    pool.query = originalQuery;
  }
});

test("HQ history applies a station-only filter", async () => {
  const originalQuery = pool.query;
  let captured;

  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  };

  try {
    await getHistory({
      query: { stationId: 9, sortBy: "recordedAt", sortOrder: "desc" },
      user: {
        role: "HQ_ADMIN",
        scope: { provinceId: null, districtId: null, stationId: null }
      }
    });
  } finally {
    pool.query = originalQuery;
  }

  assert.match(captured.sql, /t\.station_id = \$1/);
  assert.deepEqual(captured.params, [9]);
});
