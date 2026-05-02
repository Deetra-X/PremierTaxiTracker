import crypto from "node:crypto";

function ifNoneMatchMatches(headerVal, etag) {
  if (!headerVal || !etag) return false;
  const parts = headerVal
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.some((p) => p === "*" || p === etag);
}

/**
 * Sends JSON with weak ETag; returns 304 when If-None-Match matches (conditional GET).
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {object} bodyObj
 * @param {{ vary?: string[], cacheControl?: string }} [options]
 */
export function sendJsonConditional(req, res, bodyObj, options = {}) {
  const body = JSON.stringify(bodyObj);
  const hash = crypto.createHash("sha256").update(body).digest("base64url").slice(0, 32);
  const etag = `W/"${hash}"`;

  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", options.cacheControl ?? "private, max-age=0, must-revalidate");
  const vary = options.vary;
  if (vary?.length) {
    res.setHeader("Vary", vary.join(", "));
  }

  if (ifNoneMatchMatches(req.headers["if-none-match"], etag)) {
    res.status(304).end();
    return;
  }

  res.status(200).type("application/json").send(body);
}
