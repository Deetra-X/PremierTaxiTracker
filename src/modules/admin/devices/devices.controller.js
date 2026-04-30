import { z } from "zod";

import { createHttpError } from "../../../middleware/error.middleware.js";
import {
  createDevice,
  listDevices,
  rotateDeviceKey,
  updateDevice
} from "./devices.service.js";

const DeviceCreateSchema = z.object({
  imeiNumber: z.string().min(5).max(50),
  simNumber: z.string().max(20).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
  installedDate: z.string().date().optional()
});

const DeviceUpdateSchema = z.object({
  simNumber: z.string().max(20).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
  installedDate: z.string().date().optional()
});

export async function listDevicesController(req, res, next) {
  try {
    const data = await listDevices();
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createDeviceController(req, res, next) {
  try {
    const parsed = DeviceCreateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await createDevice({ input: parsed.data });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateDeviceController(req, res, next) {
  try {
    const deviceId = Number(req.params.deviceId);
    if (!Number.isInteger(deviceId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = DeviceUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await updateDevice({ deviceId, input: parsed.data });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function rotateDeviceKeyController(req, res, next) {
  try {
    const deviceId = Number(req.params.deviceId);
    if (!Number.isInteger(deviceId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const data = await rotateDeviceKey({ deviceId });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

