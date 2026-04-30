import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";

export async function listDrivers() {
  const r = await pool.query(
    `select driver_id, full_name, nic_number, phone_number, address, license_number, created_at
     from drivers
     order by driver_id`
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

export async function updateDriver({ driverId, input }) {
  const current = await pool.query(
    `select driver_id, full_name, nic_number, phone_number, address, license_number, created_at
     from drivers where driver_id = $1`,
    [driverId]
  );
  if (!current.rowCount) throw createHttpError(404, "Driver not found", "NOT_FOUND");

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

