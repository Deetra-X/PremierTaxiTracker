import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";
import {
  assertDistrictInProvince,
  assertProvinceAccess,
  assertStationInDistrict
} from "../shared/scope.js";

export async function listTukTuks({ user }) {
  const params = [];
  const where = [];
  if (user.role === "PROVINCIAL_OFFICER") {
    params.push(user.scope.provinceId);
    where.push(`t.province_id = $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const r = await pool.query(
    `select
        t.tuk_tuk_id,
        t.registration_number,
        t.driver_id,
        t.device_id,
        t.model,
        t.color,
        t.manufacture_year,
        t.province_id,
        t.district_id,
        t.station_id,
        t.is_active,
        t.registered_at
     from tuk_tuks t
     ${whereSql}
     order by t.tuk_tuk_id`,
    params
  );
  return r.rows;
}

export async function createTukTuk({ user, input }) {
  if (input.provinceId) await assertProvinceAccess({ user, provinceId: input.provinceId });
  if (user.role === "PROVINCIAL_OFFICER" && !input.provinceId) {
    // provincial users must create inside their province
    input.provinceId = user.scope.provinceId;
  }

  if (input.districtId && input.provinceId) {
    await assertDistrictInProvince({ districtId: input.districtId, provinceId: input.provinceId });
  }
  if (input.stationId && input.districtId) {
    await assertStationInDistrict({ stationId: input.stationId, districtId: input.districtId });
  }

  const r = await pool.query(
    `insert into tuk_tuks
      (driver_id, device_id, registration_number, model, color, manufacture_year,
       province_id, district_id, station_id, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning tuk_tuk_id, registration_number, driver_id, device_id, model, color,
               manufacture_year, province_id, district_id, station_id, is_active, registered_at`,
    [
      input.driverId,
      input.deviceId,
      input.registrationNumber,
      input.model ?? null,
      input.color ?? null,
      input.manufactureYear ?? null,
      input.provinceId ?? null,
      input.districtId ?? null,
      input.stationId ?? null,
      input.isActive ?? true
    ]
  );
  return r.rows[0];
}

export async function updateTukTuk({ user, tukTukId, input }) {
  const current = await pool.query(
    `select
        tuk_tuk_id, registration_number, driver_id, device_id,
        model, color, manufacture_year, province_id, district_id, station_id,
        is_active, registered_at
     from tuk_tuks where tuk_tuk_id = $1`,
    [tukTukId]
  );
  if (!current.rowCount) throw createHttpError(404, "Tuk-tuk not found", "NOT_FOUND");
  const row = current.rows[0];

  if (row.province_id) {
    await assertProvinceAccess({ user, provinceId: row.province_id });
  } else if (user.role === "PROVINCIAL_OFFICER") {
    // If existing is null province, provincial user can't modify (ambiguous)
    throw createHttpError(403, "Forbidden", "FORBIDDEN");
  }

  const next = {
    model: input.model ?? row.model,
    color: input.color ?? row.color,
    manufactureYear: input.manufactureYear ?? row.manufacture_year,
    provinceId: input.provinceId === undefined ? row.province_id : input.provinceId,
    districtId: input.districtId === undefined ? row.district_id : input.districtId,
    stationId: input.stationId === undefined ? row.station_id : input.stationId,
    isActive: input.isActive ?? row.is_active
  };

  if (next.provinceId) await assertProvinceAccess({ user, provinceId: next.provinceId });
  if (next.districtId && next.provinceId) {
    await assertDistrictInProvince({ districtId: next.districtId, provinceId: next.provinceId });
  }
  if (next.stationId && next.districtId) {
    await assertStationInDistrict({ stationId: next.stationId, districtId: next.districtId });
  }

  const r = await pool.query(
    `update tuk_tuks
     set model = $1,
         color = $2,
         manufacture_year = $3,
         province_id = $4,
         district_id = $5,
         station_id = $6,
         is_active = $7
     where tuk_tuk_id = $8
     returning tuk_tuk_id, registration_number, driver_id, device_id, model, color,
               manufacture_year, province_id, district_id, station_id, is_active, registered_at`,
    [
      next.model ?? null,
      next.color ?? null,
      next.manufactureYear ?? null,
      next.provinceId ?? null,
      next.districtId ?? null,
      next.stationId ?? null,
      next.isActive,
      tukTukId
    ]
  );
  return r.rows[0];
}

