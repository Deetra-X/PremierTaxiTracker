import { z } from "zod";

import { createHttpError } from "../../middleware/error.middleware.js";
import { getHistory, getLiveView } from "./tracking.service.js";

const LiveSchema = z.object({
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

