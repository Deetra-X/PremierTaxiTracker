import bcrypt from "bcryptjs";

import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";
import { assertProvinceAccess, assertStationInDistrict } from "../shared/scope.js";

async function getStationScope(stationId) {
  const r = await pool.query(
    `select ps.station_id, d.district_id, d.province_id
     from police_stations ps
     join districts d on d.district_id = ps.district_id
     where ps.station_id = $1`,
    [stationId]
  );
  return r.rows[0] ?? null;
}

function validateRoleStation(role, stationId) {
  if (role === "HQ_ADMIN") return;
  if (!stationId) {
    throw createHttpError(400, "stationId is required for this role", "VALIDATION_ERROR");
  }
}

function assertCanManageUserRole({ actor, targetRole }) {
  if (actor.role === "HQ_ADMIN") return;
  if (targetRole === "HQ_ADMIN" || targetRole === "PROVINCIAL_OFFICER") {
    throw createHttpError(403, "Forbidden", "FORBIDDEN");
  }
}

export async function listUsers({ user }) {
  const params = [];
  const where = [];
  if (user.role === "PROVINCIAL_OFFICER") {
    params.push(user.scope.provinceId);
    where.push(`d.province_id = $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const r = await pool.query(
    `select
        u.user_id,
        u.station_id,
        u.full_name,
        u.email,
        u.role,
        u.is_active,
        u.created_at
     from users u
     left join police_stations ps on ps.station_id = u.station_id
     left join districts d on d.district_id = ps.district_id
     ${whereSql}
     order by u.user_id`,
    params
  );
  return r.rows;
}

export async function createUser({ user, input }) {
  assertCanManageUserRole({ actor: user, targetRole: input.role });

  validateRoleStation(input.role, input.stationId ?? null);

  let stationScope = null;
  if (input.stationId) {
    stationScope = await getStationScope(input.stationId);
    if (!stationScope) throw createHttpError(400, "Invalid stationId", "VALIDATION_ERROR");
  }

  if (user.role === "PROVINCIAL_OFFICER") {
    // can only create users inside their province
    if (!stationScope) throw createHttpError(400, "stationId is required", "VALIDATION_ERROR");
    await assertProvinceAccess({ user, provinceId: stationScope.province_id });
  }

  const hash = await bcrypt.hash(input.password, 10);

  const r = await pool.query(
    `insert into users (station_id, full_name, email, password_hash, role, is_active, token_version, password_changed_at)
     values ($1, $2, $3, $4, $5, true, 0, current_timestamp)
     returning user_id, station_id, full_name, email, role, is_active, created_at`,
    [input.stationId ?? null, input.fullName, input.email.toLowerCase(), hash, input.role]
  );
  return r.rows[0];
}

export async function updateUser({ user, userId, input }) {
  const current = await pool.query(
    `select user_id, station_id, full_name, email, role, is_active, created_at
     from users where user_id = $1`,
    [userId]
  );
  if (!current.rowCount) throw createHttpError(404, "User not found", "NOT_FOUND");
  const row = current.rows[0];

  assertCanManageUserRole({ actor: user, targetRole: row.role });

  // scope enforcement for provincial (only users in province)
  if (user.role === "PROVINCIAL_OFFICER") {
    if (!row.station_id) throw createHttpError(403, "Forbidden", "FORBIDDEN");
    const scope = await getStationScope(row.station_id);
    if (!scope) throw createHttpError(403, "Forbidden", "FORBIDDEN");
    await assertProvinceAccess({ user, provinceId: scope.province_id });
  }

  const next = {
    fullName: input.fullName ?? row.full_name,
    role: input.role ?? row.role,
    stationId: input.stationId === undefined ? row.station_id : input.stationId,
    isActive: input.isActive ?? row.is_active
  };

  assertCanManageUserRole({ actor: user, targetRole: next.role });

  validateRoleStation(next.role, next.stationId);

  if (next.stationId) {
    const stationScope = await getStationScope(next.stationId);
    if (!stationScope) throw createHttpError(400, "Invalid stationId", "VALIDATION_ERROR");
    if (user.role === "PROVINCIAL_OFFICER") {
      await assertProvinceAccess({ user, provinceId: stationScope.province_id });
    }
    // station must belong to district if role changes; already implied by stationId
    await assertStationInDistrict({
      stationId: stationScope.station_id,
      districtId: stationScope.district_id
    });
  }

  const r = await pool.query(
    `update users
     set station_id = $1, full_name = $2, role = $3, is_active = $4, token_version = token_version + 1
     where user_id = $5
     returning user_id, station_id, full_name, email, role, is_active, created_at`,
    [next.stationId ?? null, next.fullName, next.role, next.isActive, userId]
  );
  return r.rows[0];
}

export async function resetUserPassword({ user, userId, password }) {
  if (user.role !== "HQ_ADMIN") {
    throw createHttpError(403, "Forbidden", "FORBIDDEN");
  }
  const hash = await bcrypt.hash(password, 10);
  const r = await pool.query(
    `update users
     set password_hash = $1, password_changed_at = current_timestamp, token_version = token_version + 1
     where user_id = $2
     returning user_id, email`,
    [hash, userId]
  );
  if (!r.rowCount) throw createHttpError(404, "User not found", "NOT_FOUND");
  return { userId: r.rows[0].user_id, email: r.rows[0].email };
}

