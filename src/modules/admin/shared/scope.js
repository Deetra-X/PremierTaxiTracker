import { pool } from "../../../config/db.js";
import { createHttpError } from "../../../middleware/error.middleware.js";

export async function assertProvinceAccess({ user, provinceId }) {
  if (user.role === "HQ_ADMIN") return;
  if (user.role !== "PROVINCIAL_OFFICER") {
    throw createHttpError(403, "Forbidden", "FORBIDDEN");
  }
  if (Number(provinceId) !== Number(user.scope.provinceId)) {
    throw createHttpError(403, "Forbidden (province scope)", "FORBIDDEN");
  }
}

export async function assertDistrictInProvince({ districtId, provinceId }) {
  const r = await pool.query(
    "select 1 from districts where district_id = $1 and province_id = $2",
    [districtId, provinceId]
  );
  if (!r.rowCount) {
    throw createHttpError(400, "District does not belong to province", "VALIDATION_ERROR");
  }
}

export async function assertStationInDistrict({ stationId, districtId }) {
  const r = await pool.query(
    "select 1 from police_stations where station_id = $1 and district_id = $2",
    [stationId, districtId]
  );
  if (!r.rowCount) {
    throw createHttpError(400, "Station does not belong to district", "VALIDATION_ERROR");
  }
}

