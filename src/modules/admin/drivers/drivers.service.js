import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";

function isProvincialOfficer(user) {
  return user?.role === "PROVINCIAL_OFFICER";
}

async function assertDriverProvinceAccess({ user, driverId }) {
  if (user?.role === "HQ_ADMIN") return;
  if (!isProvincialOfficer(user)) throw createHttpError(403, "Forbidden", "FORBIDDEN");

  const r = await pool.query(
    `select d.driver_id, t.province_id
     from drivers d
     left join tuk_tuks t on t.driver_id = d.driver_id
     where d.driver_id = $1`,
    [driverId]
  );
  if (!r.rowCount) throw createHttpError(404, "Driver not found", "NOT_FOUND");

  const allowedProvinceId = Number(user.scope.provinceId);
  const allLinksInProvince = r.rows.every(
    (row) => Number(row.province_id) === allowedProvinceId
  );
  if (!allLinksInProvince) throw createHttpError(403, "Forbidden", "FORBIDDEN");
}

export async function listDrivers({ user }) {
  if (isProvincialOfficer(user)) {
    const r = await pool.query(
      `select distinct d.driver_id, d.full_name, d.nic_number, d.phone_number, d.address, d.license_number, d.created_at
       from drivers d
       join tuk_tuks t on t.driver_id = d.driver_id
       where t.province_id = $1
         and not exists (
           select 1
           from tuk_tuks other_t
           where other_t.driver_id = d.driver_id
             and other_t.province_id is distinct from $1
         )
       order by d.driver_id`,
      [user.scope.provinceId]
    );
    return r.rows;
  }
  if (user?.role !== "HQ_ADMIN") throw createHttpError(403, "Forbidden", "FORBIDDEN");

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

export async function updateDriver({ user, driverId, input }) {
  const current = await pool.query(
    `select driver_id, full_name, nic_number, phone_number, address, license_number, created_at
     from drivers where driver_id = $1`,
    [driverId]
  );
  if (!current.rowCount) throw createHttpError(404, "Driver not found", "NOT_FOUND");
  await assertDriverProvinceAccess({ user, driverId });

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

