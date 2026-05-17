import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";

async function assertDriverAccess({ user, driverId }) {
  if (user.role === "HQ_ADMIN") return;
  if (user.role !== "PROVINCIAL_OFFICER") {
    throw createHttpError(403, "Forbidden", "FORBIDDEN");
  }

  const r = await pool.query(
    `select 1
     from tuk_tuks
     where driver_id = $1 and province_id = $2
     limit 1`,
    [driverId, user.scope.provinceId]
  );
  if (!r.rowCount) throw createHttpError(403, "Forbidden", "FORBIDDEN");
}

export async function listDrivers({ user }) {
  const params = [];
  let whereSql = "";
  if (user.role === "PROVINCIAL_OFFICER") {
    params.push(user.scope.provinceId);
    whereSql = `where exists (
       select 1
       from tuk_tuks t
       where t.driver_id = d.driver_id and t.province_id = $1
     )`;
  }

  const r = await pool.query(
    `select d.driver_id, d.full_name, d.nic_number, d.phone_number, d.address, d.license_number, d.created_at
     from drivers d
     ${whereSql}
     order by d.driver_id`,
    params
  );
  return r.rows;
}

export async function createDriver({ input }) {
  const r = await pool.query(
    `insert into drivers (full_name, nic_number, phone_number, address, license_number)
     values ($1, $2, $3, $4, $5)
     returning driver_id, full_name, nic_number, phone_number, address, license_number, created_at`,
    [
      input.fullName,
      input.nicNumber,
      input.phoneNumber ?? null,
      input.address ?? null,
      input.licenseNumber ?? null
    ]
  );
  return r.rows[0];
}

export async function updateDriver({ user, driverId, input }) {
  const current = await pool.query(
    `select driver_id, full_name, nic_number, phone_number, address, license_number, created_at
     from drivers where driver_id = $1`,
    [driverId]
  );
  if (!current.rowCount) throw createHttpError(404, "Driver not found", "NOT_FOUND");
  await assertDriverAccess({ user, driverId });

  const row = current.rows[0];
  const next = {
    fullName: input.fullName ?? row.full_name,
    phoneNumber: input.phoneNumber ?? row.phone_number,
    address: input.address ?? row.address,
    licenseNumber: input.licenseNumber ?? row.license_number
  };

  const r = await pool.query(
    `update drivers
     set full_name = $1, phone_number = $2, address = $3, license_number = $4
     where driver_id = $5
     returning driver_id, full_name, nic_number, phone_number, address, license_number, created_at`,
    [next.fullName, next.phoneNumber ?? null, next.address ?? null, next.licenseNumber ?? null, driverId]
  );
  return r.rows[0];
}

