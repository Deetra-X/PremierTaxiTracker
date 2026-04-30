import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";
import { assertProvinceAccess, assertDistrictInProvince } from "../shared/scope.js";

export async function listStations({ user, districtId }) {
  const params = [];
  const where = [];

  if (user.role === "PROVINCIAL_OFFICER") {
    params.push(user.scope.provinceId);
    where.push(`d.province_id = $${params.length}`);
  }
  if (districtId) {
    params.push(districtId);
    where.push(`ps.district_id = $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const r = await pool.query(
    `select
        ps.station_id,
        ps.district_id,
        ps.station_name,
        ps.address,
        ps.contact_number,
        ps.created_at
     from police_stations ps
     join districts d on d.district_id = ps.district_id
     ${whereSql}
     order by ps.station_id`,
    params
  );
  return r.rows;
}

export async function createStation({ user, input }) {
  // For provincial officers, district must be inside their province.
  if (user.role === "PROVINCIAL_OFFICER") {
    await assertProvinceAccess({ user, provinceId: user.scope.provinceId });
    await assertDistrictInProvince({
      districtId: input.districtId,
      provinceId: user.scope.provinceId
    });
  }

  const r = await pool.query(
    `insert into police_stations (district_id, station_name, address, contact_number)
     values ($1, $2, $3, $4)
     returning station_id, district_id, station_name, address, contact_number, created_at`,
    [input.districtId, input.stationName, input.address ?? null, input.contactNumber ?? null]
  );
  return r.rows[0];
}

export async function updateStation({ user, stationId, input }) {
  const current = await pool.query(
    `select
        ps.station_id,
        ps.district_id,
        d.province_id,
        ps.station_name,
        ps.address,
        ps.contact_number,
        ps.created_at
     from police_stations ps
     join districts d on d.district_id = ps.district_id
     where ps.station_id = $1`,
    [stationId]
  );
  if (!current.rowCount) throw createHttpError(404, "Station not found", "NOT_FOUND");
  const row = current.rows[0];
  await assertProvinceAccess({ user, provinceId: row.province_id });

  const next = {
    stationName: input.stationName ?? row.station_name,
    address: input.address ?? row.address,
    contactNumber: input.contactNumber ?? row.contact_number
  };

  const r = await pool.query(
    `update police_stations
     set station_name = $1, address = $2, contact_number = $3
     where station_id = $4
     returning station_id, district_id, station_name, address, contact_number, created_at`,
    [next.stationName, next.address ?? null, next.contactNumber ?? null, stationId]
  );
  return r.rows[0];
}

