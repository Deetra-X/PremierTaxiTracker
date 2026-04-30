import { pool } from "../../config/db.js";
import { createHttpError } from "../../middleware/error.middleware.js";

async function getTukTukById(id) {
  const r = await pool.query(
    "select tuk_tuk_id, device_id, is_active from tuk_tuks where tuk_tuk_id = $1",
    [id]
  );
  return r.rows[0] ?? null;
}

export async function ingestPing({ device, body }) {
  const tuk = await getTukTukById(body.tukTukId);
  if (!tuk) throw createHttpError(404, "Tuk-tuk not found", "NOT_FOUND");
  if (!tuk.is_active) throw createHttpError(403, "Tuk-tuk inactive", "FORBIDDEN");

  // Ensure device belongs to tuk-tuk
  if (Number(tuk.device_id) !== Number(device.deviceId)) {
    throw createHttpError(403, "Device not assigned to this tuk-tuk", "FORBIDDEN");
  }

  const recordedAt = body.recordedAt ?? new Date().toISOString();

  const r = await pool.query(
    `insert into location_logs
      (tuk_tuk_id, latitude, longitude, speed_kmh, recorded_at, location_description)
     values ($1, $2, $3, $4, $5, $6)
     returning log_id`,
    [
      body.tukTukId,
      body.latitude,
      body.longitude,
      body.speedKmh ?? null,
      recordedAt,
      body.locationDescription ?? null
    ]
  );

  return { logId: r.rows[0].log_id };
}

