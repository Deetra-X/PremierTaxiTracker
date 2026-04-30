import { z } from "zod";

import { createHttpError } from "../../../middleware/error.middleware.js";
import { createStation, listStations, updateStation } from "./stations.service.js";

const StationCreateSchema = z.object({
  districtId: z.number().int().positive(),
  stationName: z.string().min(1).max(150),
  address: z.string().max(500).optional(),
  contactNumber: z.string().max(20).optional()
});

const StationUpdateSchema = z.object({
  stationName: z.string().min(1).max(150).optional(),
  address: z.string().max(500).optional(),
  contactNumber: z.string().max(20).optional()
});

export async function listStationsController(req, res, next) {
  try {
    const districtId = req.query.districtId ? Number(req.query.districtId) : null;
    const data = await listStations({ user: req.user, districtId });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createStationController(req, res, next) {
  try {
    const parsed = StationCreateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await createStation({ user: req.user, input: parsed.data });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateStationController(req, res, next) {
  try {
    const stationId = Number(req.params.stationId);
    if (!Number.isInteger(stationId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = StationUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await updateStation({ user: req.user, stationId, input: parsed.data });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

