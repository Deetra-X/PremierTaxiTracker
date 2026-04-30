import { pool } from "../config/db.js";
import { createHttpError } from "./error.middleware.js";

function getApiKey(req) {
  const raw = req.headers["x-api-key"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

export async function requireDeviceApiKey(req, _res, next) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return next(createHttpError(401, "Missing X-API-Key", "UNAUTHORIZED"));
  }

  try {
    const r = await pool.query(
      "select device_id, status from gps_devices where api_key = $1",
      [apiKey]
    );
    if (!r.rowCount) {
      return next(createHttpError(401, "Invalid API key", "UNAUTHORIZED"));
    }

    const device = r.rows[0];
    if (device.status !== "ACTIVE") {
      return next(createHttpError(403, "Device is not active", "FORBIDDEN"));
    }

    req.device = { deviceId: device.device_id };
    return next();
  } catch (err) {
    return next(err);
  }
}

