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
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
}

const request = (await import("supertest")).default;
const express = (await import("express")).default;
const { createApp } = await import("../src/app.js");
const { pool } = await import("../src/config/db.js");
const { apiErrorHandler } = await import("../src/middleware/error.middleware.js");
const { devicesAdminRoutes } = await import("../src/modules/admin/devices/devices.routes.js");
const { updateTukTuk } = await import("../src/modules/admin/tukTuks/tukTuks.service.js");

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

test("provincial officers cannot access device key admin routes", async () => {
  const app = express();
  app.use((_req, _res, next) => {
    _req.user = {
      role: "PROVINCIAL_OFFICER",
      scope: { provinceId: 10, districtId: null, stationId: null }
    };
    next();
  });
  app.use("/devices", devicesAdminRoutes());
  app.use(apiErrorHandler);

  const res = await request(app).get("/devices");
  assert.equal(res.status, 403);
  assert.equal(res.body?.error?.code, "FORBIDDEN");
});

test("provincial officers cannot clear tuk-tuk province scope", async (t) => {
  const queries = [];
  t.mock.method(pool, "query", async (sql) => {
    const sqlText = String(sql);
    queries.push(sqlText);
    if (sqlText.includes("from tuk_tuks where tuk_tuk_id = $1")) {
      return {
        rowCount: 1,
        rows: [
          {
            tuk_tuk_id: 1,
            registration_number: "WP-1234",
            driver_id: 1,
            device_id: 1,
            model: "Bajaj",
            color: "blue",
            manufacture_year: 2023,
            province_id: 10,
            district_id: 20,
            station_id: 30,
            is_active: true,
            registered_at: new Date("2026-01-01T00:00:00Z")
          }
        ]
      };
    }
    throw new Error(`Unexpected query: ${sqlText}`);
  });

  const user = {
    role: "PROVINCIAL_OFFICER",
    scope: { provinceId: 10, districtId: null, stationId: null }
  };

  await assert.rejects(
    () =>
      updateTukTuk({
        user,
        tukTukId: 1,
        input: { provinceId: null, districtId: null, stationId: null }
      }),
    (err) => {
      assert.equal(err.status, 403);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    }
  );

  assert.equal(queries.some((sql) => sql.trim().startsWith("update tuk_tuks")), false);
});
