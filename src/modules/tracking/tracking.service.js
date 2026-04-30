import { pool } from "../../config/db.js";
import { createHttpError } from "../../middleware/error.middleware.js";

async function districtBelongsToProvince(districtId, provinceId) {
  const r = await pool.query(
    "select 1 from districts where district_id = $1 and province_id = $2",
    [districtId, provinceId]
  );
  return Boolean(r.rowCount);
}

function enforceScopeSync({ user, provinceId, districtId, stationId }) {
  const role = user?.role;
  const scope = user?.scope;
  if (!role || !scope) throw createHttpError(401, "Unauthorized", "UNAUTHORIZED");

  if (role === "HQ_ADMIN") return;

  if (role === "PROVINCIAL_OFFICER") {
    if (provinceId && Number(provinceId) !== Number(scope.provinceId)) {
      throw createHttpError(403, "Forbidden (province scope)", "FORBIDDEN");
    }
    return;
  }

  if (role === "DISTRICT_OFFICER") {
    if (provinceId && Number(provinceId) !== Number(scope.provinceId)) {
      throw createHttpError(403, "Forbidden (province scope)", "FORBIDDEN");
    }
    if (districtId && Number(districtId) !== Number(scope.districtId)) {
      throw createHttpError(403, "Forbidden (district scope)", "FORBIDDEN");
    }
    return;
  }

  if (role === "STATION_OFFICER") {
    if (provinceId && Number(provinceId) !== Number(scope.provinceId)) {
      throw createHttpError(403, "Forbidden (province scope)", "FORBIDDEN");
    }
    if (districtId && Number(districtId) !== Number(scope.districtId)) {
      throw createHttpError(403, "Forbidden (district scope)", "FORBIDDEN");
    }
    if (stationId && Number(stationId) !== Number(scope.stationId)) {
      throw createHttpError(403, "Forbidden (station scope)", "FORBIDDEN");
    }
    return;
  }

  throw createHttpError(403, "Forbidden", "FORBIDDEN");
}

export async function getLiveView({ query, user }) {
  // join to districts/provinces using tuk_tuks
  const provinceId = query.provinceId ?? null;
  const districtId = query.districtId ?? null;
  const stationId = query.stationId ?? null;

  enforceScopeSync({ user, provinceId, districtId, stationId });

  if (
    user.role === "PROVINCIAL_OFFICER" &&
    districtId &&
    !(await districtBelongsToProvince(districtId, user.scope.provinceId))
  ) {
    throw createHttpError(403, "Forbidden (district not in province)", "FORBIDDEN");
  }

  const where = [];
  const params = [];
  if (provinceId) {
    params.push(provinceId);
    where.push(`t.province_id = $${params.length}`);
  }
  if (districtId) {
    params.push(districtId);
    where.push(`t.district_id = $${params.length}`);
  }
  if (stationId) {
    params.push(stationId);
    where.push(`t.station_id = $${params.length}`);
  }

  // If not HQ, enforce minimum scope (implicit filter)
  if (user.role === "PROVINCIAL_OFFICER") {
    params.push(user.scope.provinceId);
    where.push(`t.province_id = $${params.length}`);
  } else if (user.role === "DISTRICT_OFFICER") {
    params.push(user.scope.districtId);
    where.push(`t.district_id = $${params.length}`);
  } else if (user.role === "STATION_OFFICER") {
    params.push(user.scope.stationId);
    where.push(`t.station_id = $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const sql = `
    select distinct on (ll.tuk_tuk_id)
      ll.tuk_tuk_id,
      t.registration_number,
      t.province_id,
      t.district_id,
      t.station_id,
      ll.latitude,
      ll.longitude,
      ll.speed_kmh,
      ll.recorded_at
    from location_logs ll
    join tuk_tuks t on t.tuk_tuk_id = ll.tuk_tuk_id
    ${whereSql}
    order by ll.tuk_tuk_id, ll.recorded_at desc
    limit 1000
  `;

  const r = await pool.query(sql, params);
  return r.rows;
}

export async function getHistory({ query, user }) {
  const provinceId = query.provinceId ?? null;
  const districtId = query.districtId ?? null;
  const stationId = query.stationId ?? null;

  enforceScopeSync({ user, provinceId, districtId, stationId });

  if (
    user.role === "PROVINCIAL_OFFICER" &&
    districtId &&
    !(await districtBelongsToProvince(districtId, user.scope.provinceId))
  ) {
    throw createHttpError(403, "Forbidden (district not in province)", "FORBIDDEN");
  }

  const where = [];
  const params = [];

  if (query.tukTukId) {
    params.push(query.tukTukId);
    where.push(`ll.tuk_tuk_id = $${params.length}`);
  }
  if (query.from) {
    params.push(query.from);
    where.push(`ll.recorded_at >= $${params.length}`);
  }
  if (query.to) {
    params.push(query.to);
    where.push(`ll.recorded_at <= $${params.length}`);
  }

  if (provinceId || districtId || user.role !== "HQ_ADMIN") {
    // join for filters
    if (provinceId) {
      params.push(provinceId);
      where.push(`t.province_id = $${params.length}`);
    }
    if (districtId) {
      params.push(districtId);
      where.push(`t.district_id = $${params.length}`);
    }
    if (stationId) {
      params.push(stationId);
      where.push(`t.station_id = $${params.length}`);
    }

    if (user.role === "PROVINCIAL_OFFICER") {
      params.push(user.scope.provinceId);
      where.push(`t.province_id = $${params.length}`);
    } else if (user.role === "DISTRICT_OFFICER") {
      params.push(user.scope.districtId);
      where.push(`t.district_id = $${params.length}`);
    } else if (user.role === "STATION_OFFICER") {
      params.push(user.scope.stationId);
      where.push(`t.station_id = $${params.length}`);
    }
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const sql = `
    select
      ll.log_id,
      ll.tuk_tuk_id,
      ll.latitude,
      ll.longitude,
      ll.speed_kmh,
      ll.recorded_at,
      ll.location_description
    from location_logs ll
    left join tuk_tuks t on t.tuk_tuk_id = ll.tuk_tuk_id
    ${whereSql}
    order by ll.recorded_at desc
    limit 5000
  `;

  const r = await pool.query(sql, params);
  return r.rows;
}

