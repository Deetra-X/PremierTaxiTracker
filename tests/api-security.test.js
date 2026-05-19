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
const { pool } = await import("../src/config/db.js");

function signTestToken({ userId = 7, tokenVersion = 0 } = {}) {
  return jwt.sign(
    { sub: String(userId), ver: tokenVersion },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
      issuer: process.env.JWT_ISSUER ?? "tuk-tuk-api",
      audience: process.env.JWT_AUDIENCE ?? "tuk-tuk-web",
      algorithm: process.env.JWT_ALG ?? "HS256"
    }
  );
}

async function withProvincialOfficerAuth(run) {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    const text = String(sql);
    if (text.includes("from users where user_id = $1")) {
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
    if (text.includes("from police_stations ps")) {
      assert.deepEqual(params, [11]);
      return {
        rowCount: 1,
        rows: [{ station_id: 11, district_id: 22, province_id: 33 }]
      };
    }
    throw new Error(`Unexpected query for provincial officer route test: ${text}`);
  };

  try {
    await run(signTestToken());
  } finally {
    pool.query = originalQuery;
  }
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

test("PROVINCIAL_OFFICER cannot access unscoped drivers or device API keys", async () => {
  await withProvincialOfficerAuth(async (token) => {
    const app = createApp();
    for (const path of ["/api/admin/drivers", "/api/admin/devices"]) {
      const res = await request(app).get(path).set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 403, `expected ${path} to be HQ-only`);
      assert.equal(res.body?.error?.code, "FORBIDDEN");
    }
  });
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
