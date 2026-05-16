import crypto from "node:crypto";

import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";

function genKey() {
  return crypto.randomBytes(24).toString("hex");
}

function isProvincialOfficer(user) {
  return user?.role === "PROVINCIAL_OFFICER";
}

async function assertDeviceProvinceAccess({ user, deviceId }) {
  if (user?.role === "HQ_ADMIN") return;
  if (!isProvincialOfficer(user)) throw createHttpError(403, "Forbidden", "FORBIDDEN");

  const r = await pool.query(
    `select gd.device_id, t.province_id
     from gps_devices gd
     left join tuk_tuks t on t.device_id = gd.device_id
     where gd.device_id = $1`,
    [deviceId]
  );
  if (!r.rowCount) throw createHttpError(404, "Device not found", "NOT_FOUND");

  const allowedProvinceId = Number(user.scope.provinceId);
  const allLinksInProvince = r.rows.every(
    (row) => Number(row.province_id) === allowedProvinceId
  );
  if (!allLinksInProvince) throw createHttpError(403, "Forbidden", "FORBIDDEN");
}

export async function listDevices({ user }) {
  if (isProvincialOfficer(user)) {
    const r = await pool.query(
      `select distinct gd.device_id, gd.imei_number, gd.sim_number, gd.status, gd.installed_date, gd.api_key
       from gps_devices gd
       join tuk_tuks t on t.device_id = gd.device_id
       where t.province_id = $1
         and not exists (
           select 1
           from tuk_tuks other_t
           where other_t.device_id = gd.device_id
             and other_t.province_id is distinct from $1
         )
       order by gd.device_id`,
      [user.scope.provinceId]
    );
    return r.rows;
  }
  if (user?.role !== "HQ_ADMIN") throw createHttpError(403, "Forbidden", "FORBIDDEN");

  const r = await pool.query(
    `select device_id, imei_number, sim_number, status, installed_date, api_key
     from gps_devices
     order by device_id`
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
  await assertDeviceProvinceAccess({ user, deviceId });

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
  await assertDeviceProvinceAccess({ user, deviceId });
  await pool.query("alter table gps_devices add column if not exists api_key text unique");

  const r = await pool.query(
    `update gps_devices set api_key = $1 where device_id = $2
     returning device_id, api_key`,
    [genKey(), deviceId]
  );
  if (!r.rowCount) throw createHttpError(404, "Device not found", "NOT_FOUND");
  return r.rows[0];
}

