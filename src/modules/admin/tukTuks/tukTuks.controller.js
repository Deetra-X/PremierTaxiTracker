import { z } from "zod";

import { createHttpError } from "../../../middleware/error.middleware.js";
import { sendJsonConditional } from "../../../utils/httpConditionalJson.js";
import { createTukTuk, listTukTuks, updateTukTuk } from "./tukTuks.service.js";

const ListTukTuksQuerySchema = z.object({
  sortBy: z
    .enum(["tukTukId", "registrationNumber", "registeredAt", "provinceId", "districtId"])
    .optional()
    .default("tukTukId"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc")
});

const TukTukCreateSchema = z.object({
  driverId: z.number().int().positive(),
  deviceId: z.number().int().positive(),
  registrationNumber: z.string().min(3).max(20),
  model: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  manufactureYear: z.number().int().min(1950).max(2100).optional(),
  provinceId: z.number().int().positive().optional(),
  districtId: z.number().int().positive().optional(),
  stationId: z.number().int().positive().optional(),
  isActive: z.boolean().optional()
});

const TukTukUpdateSchema = z.object({
  model: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  manufactureYear: z.number().int().min(1950).max(2100).optional(),
  provinceId: z.number().int().positive().nullable().optional(),
  districtId: z.number().int().positive().nullable().optional(),
  stationId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional()
});

export async function listTukTuksController(req, res, next) {
  try {
    const parsed = ListTukTuksQuerySchema.safeParse(req.query);
    if (!parsed.success) throw createHttpError(400, "Invalid query", "VALIDATION_ERROR");
    const data = await listTukTuks({ user: req.user, ...parsed.data });
    sendJsonConditional(req, res, { ok: true, data }, { vary: ["Authorization"] });
  } catch (err) {
    next(err);
  }
}

export async function createTukTukController(req, res, next) {
  try {
    const parsed = TukTukCreateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await createTukTuk({ user: req.user, input: parsed.data });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateTukTukController(req, res, next) {
  try {
    const tukTukId = Number(req.params.tukTukId);
    if (!Number.isInteger(tukTukId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = TukTukUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await updateTukTuk({ user: req.user, tukTukId, input: parsed.data });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

