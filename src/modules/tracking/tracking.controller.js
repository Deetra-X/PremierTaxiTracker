import { z } from "zod";

import { createHttpError } from "../../middleware/error.middleware.js";
import { getHistory, getLiveSearch, getLiveView } from "./tracking.service.js";

const LiveSchema = z.object({
  provinceId: z.coerce.number().int().positive().optional(),
  districtId: z.coerce.number().int().positive().optional(),
  stationId: z.coerce.number().int().positive().optional()
});

const LiveSearchSchema = z.object({
  q: z.string().min(2).max(80),
  provinceId: z.coerce.number().int().positive().optional(),
  districtId: z.coerce.number().int().positive().optional(),
  stationId: z.coerce.number().int().positive().optional()
});

const HistorySchema = z.object({
  tukTukId: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  provinceId: z.coerce.number().int().positive().optional(),
  districtId: z.coerce.number().int().positive().optional(),
  stationId: z.coerce.number().int().positive().optional()
});

const HistoryParamsSchema = z.object({
  tukTukId: z.coerce.number().int().positive()
});

export async function liveViewController(req, res, next) {
  try {
    const parsed = LiveSchema.safeParse(req.query);
    if (!parsed.success) throw createHttpError(400, "Invalid query", "VALIDATION_ERROR");
    const data = await getLiveView({ query: parsed.data, user: req.user });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function liveSearchController(req, res, next) {
  try {
    const parsed = LiveSearchSchema.safeParse(req.query);
    if (!parsed.success) throw createHttpError(400, "Invalid query", "VALIDATION_ERROR");
    const data = await getLiveSearch({ query: parsed.data, user: req.user });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function historyController(req, res, next) {
  try {
    const parsed = HistorySchema.safeParse(req.query);
    if (!parsed.success) throw createHttpError(400, "Invalid query", "VALIDATION_ERROR");
    const data = await getHistory({ query: parsed.data, user: req.user });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function historyByIdController(req, res, next) {
  try {
    const params = HistoryParamsSchema.safeParse(req.params);
    if (!params.success) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = HistorySchema.safeParse({ ...req.query, tukTukId: params.data.tukTukId });
    if (!parsed.success) throw createHttpError(400, "Invalid query", "VALIDATION_ERROR");
    const data = await getHistory({ query: parsed.data, user: req.user });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

