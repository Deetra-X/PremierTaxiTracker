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
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://unit:unit@localhost/unit";

const jwt = (await import("jsonwebtoken")).default;
const request = (await import("supertest")).default;
const { pool } = await import("../src/config/db.js");
const { createApp } = await import("../src/app.js");
const { getHistory } = await import("../src/modules/tracking/tracking.service.js");

function signToken(userId, version = 0) {
  return jwt.sign({ sub: String(userId), ver: version }, process.env.JWT_SECRET, {
    issuer: "tuk-tuk-api",
    audience: "tuk-tuk-web",
    algorithm: "HS256"
  });
}

function mockProvincialOfficerAuth() {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    const sqlText = String(sql);
    if (sqlText.includes("from users where user_id = $1")) {
      assert.deepEqual(params, [10]);
      return {
        rowCount: 1,
        rows: [
          {
            user_id: 10,
            station_id: 77,
            role: "PROVINCIAL_OFFICER",
            is_active: true,
            token_version: 0
          }
        ]
      };
    }

    if (sqlText.includes("from police_stations ps")) {
      assert.deepEqual(params, [77]);
      return {
        rowCount: 1,
        rows: [{ station_id: 77, district_id: 7, province_id: 3 }]
      };
    }

    throw new Error(`Unexpected query: ${sqlText}`);
  };

  return () => {
    pool.query = originalQuery;
  };
}

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

test("provincial admins cannot access global device API keys", async () => {
  const restore = mockProvincialOfficerAuth();
  try {
    const app = createApp();
    const res = await request(app)
      .get("/api/admin/devices")
      .set("Authorization", `Bearer ${signToken(10)}`);

    assert.equal(res.status, 403);
    assert.equal(res.body?.error?.code, "FORBIDDEN");
  } finally {
    restore();
  }
});

test("provincial admins cannot access the global driver roster", async () => {
  const restore = mockProvincialOfficerAuth();
  try {
    const app = createApp();
    const res = await request(app)
      .get("/api/admin/drivers")
      .set("Authorization", `Bearer ${signToken(10)}`);

    assert.equal(res.status, 403);
    assert.equal(res.body?.error?.code, "FORBIDDEN");
  } finally {
    restore();
  }
});

test("HQ station history queries include the requested station filter", async () => {
  const originalQuery = pool.query;
  try {
    let observedSql = "";
    let observedParams = [];
    pool.query = async (sql, params) => {
      observedSql = String(sql);
      observedParams = params;
      return { rows: [] };
    };

    await getHistory({
      query: { stationId: 42, sortBy: "recordedAt", sortOrder: "desc" },
      user: {
        role: "HQ_ADMIN",
        scope: { provinceId: null, districtId: null, stationId: null }
      }
    });

    assert.match(observedSql, /t\.station_id = \$1/);
    assert.deepEqual(observedParams, [42]);
  } finally {
    pool.query = originalQuery;
  }
});
