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
const { createApp } = await import("../src/app.js");
const { pool } = await import("../src/config/db.js");
const { listDevices, rotateDeviceKey } = await import("../src/modules/admin/devices/devices.service.js");
const { listDrivers, updateDriver } = await import("../src/modules/admin/drivers/drivers.service.js");

const provincialUser = {
  role: "PROVINCIAL_OFFICER",
  scope: { provinceId: 7, districtId: null, stationId: null }
};

async function withMockedPoolQuery(mockQuery, fn) {
  const originalQuery = pool.query;
  pool.query = mockQuery;
  try {
    await fn();
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

test("provincial officers list only devices scoped through their province", async () => {
  let seenSql = "";
  let seenParams = [];

  await withMockedPoolQuery(
    async (sql, params = []) => {
      seenSql = sql;
      seenParams = params;
      return { rows: [], rowCount: 0 };
    },
    async () => {
      await listDevices({ user: provincialUser });
    }
  );

  assert.match(seenSql, /join tuk_tuks t on t\.device_id = gd\.device_id/);
  assert.match(seenSql, /t\.province_id = \$1/);
  assert.match(seenSql, /not exists/);
  assert.deepEqual(seenParams, [7]);
});

test("provincial officers cannot rotate another province's device key", async () => {
  const calls = [];

  await withMockedPoolQuery(
    async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{ device_id: 55, province_id: 8 }],
        rowCount: 1
      };
    },
    async () => {
      await assert.rejects(
        () => rotateDeviceKey({ user: provincialUser, deviceId: 55 }),
        (err) => err.status === 403 && err.code === "FORBIDDEN"
      );
    }
  );

  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].sql, /update gps_devices/i);
});

test("provincial officers list only drivers scoped through their province", async () => {
  let seenSql = "";
  let seenParams = [];

  await withMockedPoolQuery(
    async (sql, params = []) => {
      seenSql = sql;
      seenParams = params;
      return { rows: [], rowCount: 0 };
    },
    async () => {
      await listDrivers({ user: provincialUser });
    }
  );

  assert.match(seenSql, /join tuk_tuks t on t\.driver_id = d\.driver_id/);
  assert.match(seenSql, /t\.province_id = \$1/);
  assert.match(seenSql, /not exists/);
  assert.deepEqual(seenParams, [7]);
});

test("provincial officers cannot update drivers linked outside their province", async () => {
  const calls = [];

  await withMockedPoolQuery(
    async (sql, params = []) => {
      calls.push({ sql, params });
      if (/from drivers where driver_id = \$1/.test(sql)) {
        return {
          rows: [
            {
              driver_id: 9,
              full_name: "Driver",
              nic_number: "NIC",
              phone_number: null,
              address: null,
              license_number: null,
              created_at: null
            }
          ],
          rowCount: 1
        };
      }
      return {
        rows: [{ driver_id: 9, province_id: 8 }],
        rowCount: 1
      };
    },
    async () => {
      await assert.rejects(
        () => updateDriver({ user: provincialUser, driverId: 9, input: { phoneNumber: "0770000000" } }),
        (err) => err.status === 403 && err.code === "FORBIDDEN"
      );
    }
  );

  assert.equal(calls.length, 2);
  assert.doesNotMatch(calls.at(-1).sql, /update drivers/i);
});
