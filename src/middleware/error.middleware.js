export function apiErrorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  const _next = next;

  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  const code = err?.code ?? "INTERNAL_ERROR";
  const message =
    status >= 500 ? "Internal server error" : err?.message ?? "Request failed";

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({ ok: false, error: { code, message } });
}

export function createHttpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

