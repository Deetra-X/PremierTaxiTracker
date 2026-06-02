import rateLimit from "express-rate-limit";

function parsePositiveInt(raw, fallback) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function createRateLimiters() {
  const globalLimit =
    process.env.NODE_ENV === "test"
      ? parsePositiveInt(process.env.TEST_GLOBAL_RATE_LIMIT, 300)
      : 300;

  const global = rateLimit({
    windowMs: 60 * 1000,
    limit: globalLimit,
    standardHeaders: true,
    legacyHeaders: false
  });

  const auth = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false
  });

  const device = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false
  });

  const tracking = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  });

  return { global, auth, device, tracking };
}

