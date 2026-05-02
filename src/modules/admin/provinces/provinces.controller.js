import { z } from "zod";

import { createHttpError } from "../../../middleware/error.middleware.js";
import { sendJsonConditional } from "../../../utils/httpConditionalJson.js";
import { createProvince, listProvinces, updateProvince } from "./provinces.service.js";

const ListProvincesQuerySchema = z.object({
  sortBy: z.enum(["provinceId", "name", "createdAt"]).optional().default("provinceId"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc")
});

const ProvinceCreateSchema = z.object({
  name: z.string().min(1).max(100)
});

const ProvinceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional()
});

export async function listProvincesController(req, res, next) {
  try {
    const parsed = ListProvincesQuerySchema.safeParse(req.query);
    if (!parsed.success) throw createHttpError(400, "Invalid query", "VALIDATION_ERROR");
    const data = await listProvinces(parsed.data);
    sendJsonConditional(req, res, { ok: true, data }, { vary: ["Authorization"] });
  } catch (err) {
    next(err);
  }
}

export async function createProvinceController(req, res, next) {
  try {
    if (req.user.role !== "HQ_ADMIN") {
      throw createHttpError(403, "Forbidden", "FORBIDDEN");
    }
    const parsed = ProvinceCreateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await createProvince({ input: parsed.data });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateProvinceController(req, res, next) {
  try {
    if (req.user.role !== "HQ_ADMIN") {
      throw createHttpError(403, "Forbidden", "FORBIDDEN");
    }
    const provinceId = Number(req.params.provinceId);
    if (!Number.isInteger(provinceId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = ProvinceUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await updateProvince({ provinceId, input: parsed.data });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

