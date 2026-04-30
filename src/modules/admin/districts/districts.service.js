import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";
import { assertProvinceAccess } from "../shared/scope.js";

export async function listDistricts({ user, provinceId }) {
  const params = [];
  const where = [];

  if (user.role === "PROVINCIAL_OFFICER") {
    params.push(user.scope.provinceId);
    where.push(`province_id = $${params.length}`);
  }
  if (provinceId) {
    params.push(provinceId);
    where.push(`province_id = $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const r = await pool.query(
    `select district_id, province_id, name, created_at
     from districts
     ${whereSql}
     order by district_id`,
    params
  );
  return r.rows;
}

export async function createDistrict({ user, input }) {
  await assertProvinceAccess({ user, provinceId: input.provinceId });
  const r = await pool.query(
    `insert into districts (province_id, name)
     values ($1, $2)
     returning district_id, province_id, name, created_at`,
    [input.provinceId, input.name]
  );
  return r.rows[0];
}

export async function updateDistrict({ user, districtId, input }) {
  // find district + enforce province scope
  const current = await pool.query(
    "select district_id, province_id, name, created_at from districts where district_id = $1",
    [districtId]
  );
  if (!current.rowCount) throw createHttpError(404, "District not found", "NOT_FOUND");
  await assertProvinceAccess({ user, provinceId: current.rows[0].province_id });

  if (!input.name) return current.rows[0];
  const r = await pool.query(
    "update districts set name = $1 where district_id = $2 returning district_id, province_id, name, created_at",
    [input.name, districtId]
  );
  return r.rows[0];
}

