import crypto from "node:crypto";

import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";

function genKey() {
  return crypto.randomBytes(24).toString("hex");
}

async function assertDeviceAccess({ user, deviceId }) {
  if (user.role === "HQ_ADMIN") return;
  if (user.role !== "PROVINCIAL_OFFICER") {
    throw createHttpError(403, "Forbidden", "FORBIDDEN");
  }

  const r = await pool.query(
    `select 1
     from tuk_tuks
     where device_id = $1 and province_id = $2
     limit 1`,
    [deviceId, user.scope.provinceId]
  );
  if (!r.rowCount) throw createHttpError(403, "Forbidden", "FORBIDDEN");
}

export async function listDevices({ user }) {
  const params = [];
  let whereSql = "";
  if (user.role === "PROVINCIAL_OFFICER") {
    params.push(user.scope.provinceId);
    whereSql = `where exists (
       select 1
       from tuk_tuks t
       where t.device_id = gd.device_id and t.province_id = $1
     )`;
  }

  const r = await pool.query(
    `select gd.device_id, gd.imei_number, gd.sim_number, gd.status, gd.installed_date, gd.api_key
     from gps_devices gd
     ${whereSql}
     order by gd.device_id`,
    params
  );
  return r.rows;
}

export async function createDevice({ input }) {
  // Ensure api_key column exists (created by our earlier script/migration)
  await pool.query("alter table gps_devices add column if not exists api_key text unique");

  const r = await pool.query(
    `insert into gps_devices (imei_number, sim_number, status, installed_date, api_key)
     values ($1, $2, $3, $4, $5)
     returning device_id, imei_number, sim_number, status, installed_date, api_key`,
    [
      input.imeiNumber,
      input.simNumber ?? null,
      input.status ?? "ACTIVE",
      input.installedDate ?? null,
      genKey()
    ]
  );
  return r.rows[0];
}

export async function updateDevice({ user, deviceId, input }) {
  const current = await pool.query(
    `select device_id, imei_number, sim_number, status, installed_date, api_key
     from gps_devices where device_id = $1`,
    [deviceId]
  );
  if (!current.rowCount) throw createHttpError(404, "Device not found", "NOT_FOUND");
  await assertDeviceAccess({ user, deviceId });
  const row = current.rows[0];
  const next = {
    simNumber: input.simNumber ?? row.sim_number,
    status: input.status ?? row.status,
    installedDate: input.installedDate ?? row.installed_date
  };
  const r = await pool.query(
    `update gps_devices
     set sim_number = $1, status = $2, installed_date = $3
     where device_id = $4
     returning device_id, imei_number, sim_number, status, installed_date, api_key`,
    [next.simNumber ?? null, next.status, next.installedDate ?? null, deviceId]
  );
  return r.rows[0];
}

export async function rotateDeviceKey({ user, deviceId }) {
  const current = await pool.query("select device_id from gps_devices where device_id = $1", [deviceId]);
  if (!current.rowCount) throw createHttpError(404, "Device not found", "NOT_FOUND");
  await assertDeviceAccess({ user, deviceId });

  await pool.query("alter table gps_devices add column if not exists api_key text unique");

  const r = await pool.query(
    `update gps_devices set api_key = $1 where device_id = $2
     returning device_id, api_key`,
    [genKey(), deviceId]
  );
  if (!r.rowCount) throw createHttpError(404, "Device not found", "NOT_FOUND");
  return r.rows[0];
}

