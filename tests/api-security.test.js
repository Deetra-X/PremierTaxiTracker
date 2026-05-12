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
const express = (await import("express")).default;
const { createApp } = await import("../src/app.js");
const { devicesAdminRoutes } = await import("../src/modules/admin/devices/devices.routes.js");

function createDevicesAdminTestApp(role) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { role, scope: { provinceId: 1 } };
    next();
  });
  app.use("/devices", devicesAdminRoutes());
  app.use((err, _req, res, _next) => {
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
    res.status(status).json({
      ok: false,
      error: {
        code: err?.code ?? "INTERNAL_ERROR",
        message: err?.message ?? "Request failed"
      }
    });
  });
  return app;
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

test("provincial admins cannot reach device API-key administration", async () => {
  const app = createDevicesAdminTestApp("PROVINCIAL_OFFICER");

  const list = await request(app).get("/devices");
  assert.equal(list.status, 403);
  assert.equal(list.body?.error?.code, "FORBIDDEN");

  const rotate = await request(app).post("/devices/1/rotate-key");
  assert.equal(rotate.status, 403);
  assert.equal(rotate.body?.error?.code, "FORBIDDEN");
});
