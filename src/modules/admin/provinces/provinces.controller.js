import { z } from "zod";

import { createHttpError } from "../../../middleware/error.middleware.js";
import { createProvince, listProvinces, updateProvince } from "./provinces.service.js";

const ProvinceCreateSchema = z.object({
  name: z.string().min(1).max(100)
});

const ProvinceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional()
});

export async function listProvincesController(req, res, next) {
  try {
    const data = await listProvinces({ user: req.user });
    res.json({ ok: true, data });
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

