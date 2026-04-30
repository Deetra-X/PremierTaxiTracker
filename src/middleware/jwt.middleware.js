import jwt from "jsonwebtoken";

import { getEnv } from "../config/env.js";
import { createHttpError } from "./error.middleware.js";

export function requireJwt(req, _res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return next(createHttpError(401, "Missing bearer token", "UNAUTHORIZED"));
  }

  const token = auth.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, getEnv("JWT_SECRET"));
    req.user = payload;
    return next();
  } catch {
    return next(createHttpError(401, "Invalid token", "UNAUTHORIZED"));
  }
}

