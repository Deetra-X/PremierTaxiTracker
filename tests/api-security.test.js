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
const { createApp } = await import("../src/app.js");
const { pool } = await import("../src/config/db.js");
const { createTukTuk, updateTukTuk } = await import("../src/modules/admin/tukTuks/tukTuks.service.js");

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

test("creating an active tuk-tuk rejects a device already assigned to another active tuk-tuk", async () => {
  const originalConnect = pool.connect;
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql === "begin" || sql === "commit" || sql === "rollback") return { rowCount: 0, rows: [] };
      if (sql.includes("pg_advisory_xact_lock")) return { rowCount: 1, rows: [{}] };
      if (sql.includes("from gps_devices")) {
        return { rowCount: 1, rows: [{ device_id: 42, status: "ACTIVE" }] };
      }
      if (sql.includes("from tuk_tuks") && sql.includes("is_active = true")) {
        return { rowCount: 1, rows: [{ tuk_tuk_id: 7 }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };

  pool.connect = async () => client;
  try {
    await assert.rejects(
      createTukTuk({
        user: { role: "HQ_ADMIN", scope: {} },
        input: { driverId: 1, deviceId: 42, registrationNumber: "WP-1234" }
      }),
      (err) => err.status === 409 && err.code === "CONFLICT"
    );
  } finally {
    pool.connect = originalConnect;
  }

  assert.ok(!queries.some(({ sql }) => sql.includes("insert into tuk_tuks")));
  assert.ok(queries.some(({ sql }) => sql === "rollback"));
});

test("activating a tuk-tuk rejects a device already assigned to another active tuk-tuk", async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql === "begin" || sql === "commit" || sql === "rollback") return { rowCount: 0, rows: [] };
      if (sql.includes("pg_advisory_xact_lock")) return { rowCount: 1, rows: [{}] };
      if (sql.includes("from gps_devices")) {
        return { rowCount: 1, rows: [{ device_id: 42, status: "ACTIVE" }] };
      }
      if (sql.includes("from tuk_tuks") && sql.includes("is_active = true")) {
        assert.deepEqual(params, [42, 5]);
        return { rowCount: 1, rows: [{ tuk_tuk_id: 7 }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };

  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("from tuk_tuks where tuk_tuk_id = $1")) {
      return {
        rowCount: 1,
        rows: [
          {
            tuk_tuk_id: 5,
            registration_number: "WP-5678",
            driver_id: 1,
            device_id: 42,
            model: null,
            color: null,
            manufacture_year: null,
            province_id: null,
            district_id: null,
            station_id: null,
            is_active: false,
            registered_at: new Date().toISOString()
          }
        ]
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  pool.connect = async () => client;

  try {
    await assert.rejects(
      updateTukTuk({
        user: { role: "HQ_ADMIN", scope: {} },
        tukTukId: 5,
        input: { isActive: true }
      }),
      (err) => err.status === 409 && err.code === "CONFLICT"
    );
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }

  assert.ok(!queries.some(({ sql }) => sql.includes("update tuk_tuks")));
  assert.ok(queries.some(({ sql }) => sql === "rollback"));
});
