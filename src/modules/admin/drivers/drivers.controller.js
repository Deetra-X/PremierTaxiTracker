import { z } from "zod";

import { createHttpError } from "../../../middleware/error.middleware.js";
import { createDriver, listDrivers, updateDriver } from "./drivers.service.js";

const DriverCreateSchema = z.object({
  fullName: z.string().min(1).max(150),
  nicNumber: z.string().min(5).max(20),
  phoneNumber: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  licenseNumber: z.string().max(50).optional()
});

const DriverUpdateSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  phoneNumber: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  licenseNumber: z.string().max(50).optional()
});

export async function listDriversController(req, res, next) {
  try {
    const data = await listDrivers({ user: req.user });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createDriverController(req, res, next) {
  try {
    const parsed = DriverCreateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await createDriver({ user: req.user, input: parsed.data });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateDriverController(req, res, next) {
  try {
    const driverId = Number(req.params.driverId);
    if (!Number.isInteger(driverId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = DriverUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await updateDriver({ user: req.user, driverId, input: parsed.data });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

