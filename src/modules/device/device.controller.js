import { z } from "zod";

import { createHttpError } from "../../middleware/error.middleware.js";
import { ingestPing } from "./device.service.js";

const PingSchema = z.object({
  tukTukId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(250).optional(),
  recordedAt: z.string().datetime().optional(),
  locationDescription: z.string().max(255).optional()
});

export async function ingestPingController(req, res, next) {
  try {
    const parsed = PingSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");

    const out = await ingestPing({
      device: req.device,
      body: parsed.data
    });

    res.status(201).json({ ok: true, data: out });
  } catch (err) {
    next(err);
  }
}

