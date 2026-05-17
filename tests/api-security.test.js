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
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://unit-test:unit-test@localhost:5432/unit-test";
}

const request = (await import("supertest")).default;
const jwt = (await import("jsonwebtoken")).default;
const { createApp } = await import("../src/app.js");
const { pool } = await import("../src/config/db.js");

function signProvincialOfficerToken() {
  return jwt.sign({ ver: 0 }, process.env.JWT_SECRET, {
    subject: "42",
    issuer: "tuk-tuk-api",
    audience: "tuk-tuk-web"
  });
}

function mockProvincialOfficerAuth(t, queryHandler) {
  const originalQuery = pool.query;
  t.after(() => {
    pool.query = originalQuery;
  });

  pool.query = async (sql, params = []) => {
    const text = String(sql);
    if (text.includes("from users where user_id = $1")) {
      return {
        rowCount: 1,
        rows: [
          {
            user_id: 42,
            station_id: 5,
            role: "PROVINCIAL_OFFICER",
            is_active: true,
            token_version: 0
          }
        ]
      };
    }
    if (text.includes("from police_stations ps")) {
      return {
        rowCount: 1,
        rows: [{ station_id: 5, district_id: 9, province_id: 77 }]
      };
    }
    return queryHandler(text, params);
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

test("provincial officer device list is scoped to their province", async (t) => {
  const app = createApp();
  let sawScopedDeviceQuery = false;
  mockProvincialOfficerAuth(t, async (text, params) => {
    if (text.includes("from gps_devices gd")) {
      sawScopedDeviceQuery = true;
      assert.match(text, /where exists/);
      assert.match(text, /t\.device_id = gd\.device_id/);
      assert.match(text, /t\.province_id = \$1/);
      assert.deepEqual(params, [77]);
      return {
        rowCount: 1,
        rows: [{ device_id: 100, imei_number: "imei", status: "ACTIVE", api_key: "province-key" }]
      };
    }
    throw new Error(`unexpected query: ${text}`);
  });

  const res = await request(app)
    .get("/api/admin/devices")
    .set("Authorization", `Bearer ${signProvincialOfficerToken()}`);

  assert.equal(res.status, 200);
  assert.equal(sawScopedDeviceQuery, true);
  assert.equal(res.body.data[0].api_key, "province-key");
});

test("provincial officer cannot rotate a device key outside their province", async (t) => {
  const app = createApp();
  mockProvincialOfficerAuth(t, async (text, params) => {
    if (text.includes("select device_id from gps_devices where device_id = $1")) {
      assert.deepEqual(params, [100]);
      return { rowCount: 1, rows: [{ device_id: 100 }] };
    }
    if (text.includes("from tuk_tuks")) {
      assert.deepEqual(params, [100, 77]);
      return { rowCount: 0, rows: [] };
    }
    if (text.includes("update gps_devices")) {
      throw new Error("cross-province device key rotation should not execute");
    }
    return { rowCount: 0, rows: [] };
  });

  const res = await request(app)
    .post("/api/admin/devices/100/rotate-key")
    .set("Authorization", `Bearer ${signProvincialOfficerToken()}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "FORBIDDEN");
});

test("provincial officer driver list is scoped to their province", async (t) => {
  const app = createApp();
  let sawScopedDriverQuery = false;
  mockProvincialOfficerAuth(t, async (text, params) => {
    if (text.includes("from drivers d")) {
      sawScopedDriverQuery = true;
      assert.match(text, /where exists/);
      assert.match(text, /t\.driver_id = d\.driver_id/);
      assert.match(text, /t\.province_id = \$1/);
      assert.deepEqual(params, [77]);
      return {
        rowCount: 1,
        rows: [{ driver_id: 200, full_name: "Province Driver", nic_number: "12345" }]
      };
    }
    throw new Error(`unexpected query: ${text}`);
  });

  const res = await request(app)
    .get("/api/admin/drivers")
    .set("Authorization", `Bearer ${signProvincialOfficerToken()}`);

  assert.equal(res.status, 200);
  assert.equal(sawScopedDriverQuery, true);
  assert.equal(res.body.data[0].driver_id, 200);
});

test("provincial officer cannot update a driver outside their province", async (t) => {
  const app = createApp();
  mockProvincialOfficerAuth(t, async (text, params) => {
    if (text.includes("from drivers where driver_id = $1")) {
      assert.deepEqual(params, [200]);
      return {
        rowCount: 1,
        rows: [{ driver_id: 200, full_name: "Other Driver", nic_number: "99999" }]
      };
    }
    if (text.includes("from tuk_tuks")) {
      assert.deepEqual(params, [200, 77]);
      return { rowCount: 0, rows: [] };
    }
    if (text.includes("update drivers")) {
      throw new Error("cross-province driver update should not execute");
    }
    return { rowCount: 0, rows: [] };
  });

  const res = await request(app)
    .patch("/api/admin/drivers/200")
    .set("Authorization", `Bearer ${signProvincialOfficerToken()}`)
    .send({ fullName: "Changed" });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "FORBIDDEN");
});
