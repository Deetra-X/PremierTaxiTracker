import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/test";

const { pool } = await import("../src/config/db.js");
const { listDevices, rotateDeviceKey, updateDevice } = await import(
  "../src/modules/admin/devices/devices.service.js"
);

const provincialUser = {
  role: "PROVINCIAL_OFFICER",
  scope: { provinceId: 7, districtId: null, stationId: null }
};

function stubPoolQuery(t, handler) {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params = []) => {
    calls.push({ sql, params });
    return handler({ sql, params, calls });
  };
  t.after(() => {
    pool.query = original;
  });
  return calls;
}

test("provincial device list is limited to devices assigned only in caller province", async (t) => {
  const calls = stubPoolQuery(t, () => ({ rows: [] }));

  await listDevices({ user: provincialUser });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [7]);
  assert.match(calls[0].sql, /where exists/i);
  assert.match(calls[0].sql, /not exists/i);
  assert.match(calls[0].sql, /t\.province_id = \$1/i);
  assert.match(calls[0].sql, /t\.province_id is distinct from \$1/i);
});

test("provincial device update is denied before writing when device is outside scope", async (t) => {
  const calls = stubPoolQuery(t, () => ({
    rows: [{ device_count: 1, in_scope_assignments: 0, out_of_scope_assignments: 1 }]
  }));

  await assert.rejects(
    updateDevice({ user: provincialUser, deviceId: 42, input: { status: "INACTIVE" } }),
    (err) => err.status === 403 && err.code === "FORBIDDEN"
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /left join tuk_tuks/i);
  assert.doesNotMatch(calls[0].sql, /update gps_devices/i);
});

test("provincial key rotation is denied before writing when device has any out-of-scope assignment", async (t) => {
  const calls = stubPoolQuery(t, () => ({
    rows: [{ device_count: 1, in_scope_assignments: 1, out_of_scope_assignments: 1 }]
  }));

  await assert.rejects(
    rotateDeviceKey({ user: provincialUser, deviceId: 42 }),
    (err) => err.status === 403 && err.code === "FORBIDDEN"
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /left join tuk_tuks/i);
  assert.doesNotMatch(calls[0].sql, /update gps_devices/i);
});
