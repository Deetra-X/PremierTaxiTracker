import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { pool } from "../../config/db.js";
import { getEnv } from "../../config/env.js";
import { createHttpError } from "../../middleware/error.middleware.js";

async function getUserByEmail(email) {
  const r = await pool.query(
    `select user_id, station_id, full_name, email, password_hash, role, is_active
     from users
     where email = $1`,
    [email]
  );
  return r.rows[0] ?? null;
}

async function getScopeForUser({ role, station_id }) {
  if (role === "HQ_ADMIN") {
    return { provinceId: null, districtId: null, stationId: null };
  }

  if (!station_id) {
    // non-HQ must be assigned to a station to infer scope from your schema
    throw createHttpError(403, "User scope not configured", "SCOPE_MISSING");
  }

  const r = await pool.query(
    `select
        ps.station_id,
        d.district_id,
        d.province_id
     from police_stations ps
     join districts d on d.district_id = ps.district_id
     where ps.station_id = $1`,
    [station_id]
  );
  if (!r.rowCount) {
    throw createHttpError(403, "User station not found", "SCOPE_INVALID");
  }

  const row = r.rows[0];
  if (role === "PROVINCIAL_OFFICER") {
    return { provinceId: row.province_id, districtId: null, stationId: null };
  }
  if (role === "DISTRICT_OFFICER") {
    return { provinceId: row.province_id, districtId: row.district_id, stationId: null };
  }
  // STATION_OFFICER
  return { provinceId: row.province_id, districtId: row.district_id, stationId: row.station_id };
}

export async function login({ email, password }) {
  const user = await getUserByEmail(email.toLowerCase());
  if (!user || !user.is_active) {
    throw createHttpError(401, "Invalid credentials", "UNAUTHORIZED");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw createHttpError(401, "Invalid credentials", "UNAUTHORIZED");
  }

  const scope = await getScopeForUser(user);

  const token = jwt.sign(
    {
      sub: String(user.user_id),
      role: user.role,
      stationId: user.station_id ?? null,
      scope
    },
    getEnv("JWT_SECRET"),
    { expiresIn: "8h" }
  );

  return {
    token,
    user: {
      id: user.user_id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      scope
    }
  };
}

