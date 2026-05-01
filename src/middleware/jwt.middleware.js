import jwt from "jsonwebtoken";

import { pool } from "../config/db.js";
import { getEnv } from "../config/env.js";
import { createHttpError } from "./error.middleware.js";

async function getScopeForUserFromDb({ role, stationId }) {
  if (role === "HQ_ADMIN") return { provinceId: null, districtId: null, stationId: null };
  if (!stationId) {
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
    [stationId]
  );
  if (!r.rowCount) {
    throw createHttpError(403, "User station not found", "SCOPE_INVALID");
  }

  const row = r.rows[0];
  if (role === "PROVINCIAL_OFFICER") return { provinceId: row.province_id, districtId: null, stationId: null };
  if (role === "DISTRICT_OFFICER") {
    return { provinceId: row.province_id, districtId: row.district_id, stationId: null };
  }
  // STATION_OFFICER
  return { provinceId: row.province_id, districtId: row.district_id, stationId: row.station_id };
}

export async function requireJwt(req, _res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return next(createHttpError(401, "Missing bearer token", "UNAUTHORIZED"));
  }

  const token = auth.slice("Bearer ".length).trim();
  try {
    const jwtIssuer = getEnv("JWT_ISSUER", { defaultValue: "tuk-tuk-api" });
    const jwtAudience = getEnv("JWT_AUDIENCE", { defaultValue: "tuk-tuk-web" });
    const jwtAlg = getEnv("JWT_ALG", { defaultValue: "HS256" });

    const payload = jwt.verify(token, getEnv("JWT_SECRET"), {
      issuer: jwtIssuer,
      audience: jwtAudience,
      algorithms: [jwtAlg]
    });

    const sub = payload?.sub;
    const userId = Number(sub);
    if (!sub || !Number.isInteger(userId) || userId <= 0) {
      return next(createHttpError(401, "Invalid token subject", "UNAUTHORIZED"));
    }

    const tokenVer = Number(payload?.ver ?? -1);
    if (!Number.isInteger(tokenVer) || tokenVer < 0) {
      return next(createHttpError(401, "Invalid token version", "UNAUTHORIZED"));
    }

    const r = await pool.query(
      "select user_id, station_id, role, is_active, token_version from users where user_id = $1",
      [userId]
    );
    if (!r.rowCount) return next(createHttpError(401, "Invalid token", "UNAUTHORIZED"));

    const u = r.rows[0];
    if (!u.is_active) return next(createHttpError(401, "User disabled", "UNAUTHORIZED"));
    if (Number(u.token_version ?? 0) !== tokenVer) {
      return next(createHttpError(401, "Token revoked", "UNAUTHORIZED"));
    }

    const role = u.role;
    const stationId = u.station_id ?? null;
    const scope = await getScopeForUserFromDb({ role, stationId });

    // Do not trust role/scope from the token; always hydrate from DB
    req.user = {
      sub: String(u.user_id),
      role,
      stationId,
      scope
    };

    return next();
  } catch {
    return next(createHttpError(401, "Invalid token", "UNAUTHORIZED"));
  }
}

