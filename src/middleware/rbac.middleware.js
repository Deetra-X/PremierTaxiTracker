import { createHttpError } from "./error.middleware.js";

export function requireRoles(...roles) {
  const allowed = new Set(roles);
  return function requireRolesMiddleware(req, _res, next) {
    const role = req.user?.role;
    if (!role) return next(createHttpError(401, "Unauthorized", "UNAUTHORIZED"));
    if (!allowed.has(role)) {
      return next(createHttpError(403, "Forbidden", "FORBIDDEN"));
    }
    return next();
  };
}

export function getUserScope(req) {
  const scope = req.user?.scope;
  if (!scope) throw createHttpError(401, "Unauthorized", "UNAUTHORIZED");
  return scope;
}

