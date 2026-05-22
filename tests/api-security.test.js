/**
 * JWT protection + rate limiting smoke tests.
 * Run: npm test
 *
 * Uses TEST_GLOBAL_RATE_LIMIT so rate-limit assertions stay fast without changing production defaults.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.TEST_GLOBAL_RATE_LIMIT = "5";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "unit-test-jwt-secret-at-least-32-characters-long";
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://unit:unit@localhost:5432/unit_test";
}

const request = (await import("supertest")).default;
const { createApp } = await import("../src/app.js");
const { pool } = await import("../src/config/db.js");
const { createUser, updateUser } = await import("../src/modules/admin/users/users.service.js");

function signAuthToken(userId) {
  return jwt.sign(
    { sub: String(userId), ver: 0 },
    process.env.JWT_SECRET,
    { issuer: "tuk-tuk-api", audience: "tuk-tuk-web", algorithm: "HS256", expiresIn: "1h" }
  );
}

function stubProvincialAuth(t, { userId = 42, stationId = 10, districtId = 20, provinceId = 30 } = {}) {
  const originalQuery = pool.query;
  t.after(() => {
    pool.query = originalQuery;
  });

  let protectedResourceQueried = false;
  pool.query = async (sql, params) => {
    const text = String(sql);
    if (text.includes("from users where user_id = $1")) {
      assert.deepEqual(params, [userId]);
      return {
        rowCount: 1,
        rows: [{
          user_id: userId,
          station_id: stationId,
          role: "PROVINCIAL_OFFICER",
          is_active: true,
          token_version: 0
        }]
      };
    }
    if (text.includes("from police_stations ps")) {
      assert.deepEqual(params, [stationId]);
      return {
        rowCount: 1,
        rows: [{ station_id: stationId, district_id: districtId, province_id: provinceId }]
      };
    }

    protectedResourceQueried = true;
    throw new Error(`unexpected query after authorization guard: ${text}`);
  };

  return {
    token: signAuthToken(userId),
    wasProtectedResourceQueried: () => protectedResourceQueried
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

test("provincial officer cannot access HQ-only device and driver admin data", async (t) => {
  const app = createApp();
  const auth = stubProvincialAuth(t);

  const devices = await request(app)
    .get("/api/admin/devices")
    .set("Authorization", `Bearer ${auth.token}`);
  assert.equal(devices.status, 403);
  assert.equal(devices.body?.error?.code, "FORBIDDEN");

  const drivers = await request(app)
    .get("/api/admin/drivers")
    .set("Authorization", `Bearer ${auth.token}`);
  assert.equal(drivers.status, 403);
  assert.equal(drivers.body?.error?.code, "FORBIDDEN");

  assert.equal(auth.wasProtectedResourceQueried(), false);
});

test("provincial officer cannot create or promote provincial admins", async (t) => {
  const actor = {
    role: "PROVINCIAL_OFFICER",
    scope: { provinceId: 30, districtId: null, stationId: null }
  };

  await assert.rejects(
    () => createUser({
      user: actor,
      input: {
        fullName: "Province Admin",
        email: "province-admin@example.test",
        role: "PROVINCIAL_OFFICER",
        stationId: 10,
        password: "secret123"
      }
    }),
    (err) => err?.status === 403 && err?.code === "FORBIDDEN"
  );

  const originalQuery = pool.query;
  t.after(() => {
    pool.query = originalQuery;
  });

  let updateAttempted = false;
  pool.query = async (sql, params) => {
    const text = String(sql);
    if (text.includes("from users where user_id = $1")) {
      assert.deepEqual(params, [77]);
      return {
        rowCount: 1,
        rows: [{
          user_id: 77,
          station_id: 10,
          full_name: "Station Officer",
          email: "station-officer@example.test",
          role: "STATION_OFFICER",
          is_active: true,
          created_at: "2026-01-01T00:00:00.000Z"
        }]
      };
    }
    if (text.includes("from police_stations ps")) {
      assert.deepEqual(params, [10]);
      return {
        rowCount: 1,
        rows: [{ station_id: 10, district_id: 20, province_id: 30 }]
      };
    }

    if (text.includes("update users")) {
      updateAttempted = true;
    }
    throw new Error(`unexpected query while checking role escalation: ${text}`);
  };

  await assert.rejects(
    () => updateUser({
      user: actor,
      userId: 77,
      input: { role: "PROVINCIAL_OFFICER" }
    }),
    (err) => err?.status === 403 && err?.code === "FORBIDDEN"
  );
  assert.equal(updateAttempted, false);
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
