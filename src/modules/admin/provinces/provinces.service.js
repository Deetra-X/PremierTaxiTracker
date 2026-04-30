import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";

export async function listProvinces() {
  const r = await pool.query(
    "select province_id, name, created_at from provinces order by province_id"
  );
  return r.rows;
}

export async function createProvince({ input }) {
  const r = await pool.query(
    "insert into provinces (name) values ($1) returning province_id, name, created_at",
    [input.name]
  );
  return r.rows[0];
}

export async function updateProvince({ provinceId, input }) {
  if (!input.name) return getProvinceOr404(provinceId);
  const r = await pool.query(
    "update provinces set name = $1 where province_id = $2 returning province_id, name, created_at",
    [input.name, provinceId]
  );
  if (!r.rowCount) throw createHttpError(404, "Province not found", "NOT_FOUND");
  return r.rows[0];
}

async function getProvinceOr404(provinceId) {
  const r = await pool.query(
    "select province_id, name, created_at from provinces where province_id = $1",
    [provinceId]
  );
  if (!r.rowCount) throw createHttpError(404, "Province not found", "NOT_FOUND");
  return r.rows[0];
}

