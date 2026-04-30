import { z } from "zod";

import { createHttpError } from "../../../middleware/error.middleware.js";
import { createDistrict, listDistricts, updateDistrict } from "./districts.service.js";

const DistrictCreateSchema = z.object({
  provinceId: z.number().int().positive(),
  name: z.string().min(1).max(100)
});

const DistrictUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional()
});

export async function listDistrictsController(req, res, next) {
  try {
    const provinceId = req.query.provinceId ? Number(req.query.provinceId) : null;
    const data = await listDistricts({ user: req.user, provinceId });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createDistrictController(req, res, next) {
  try {
    const parsed = DistrictCreateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await createDistrict({ user: req.user, input: parsed.data });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateDistrictController(req, res, next) {
  try {
    const districtId = Number(req.params.districtId);
    if (!Number.isInteger(districtId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = DistrictUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await updateDistrict({ user: req.user, districtId, input: parsed.data });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

