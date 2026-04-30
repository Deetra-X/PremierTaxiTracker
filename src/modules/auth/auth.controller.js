import { z } from "zod";

import { createHttpError } from "../../middleware/error.middleware.js";
import { login } from "./auth.service.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function loginController(req, res, next) {
  try {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) {
      throw createHttpError(400, "Invalid login payload", "VALIDATION_ERROR");
    }

    const out = await login(body.data);
    res.json({ ok: true, data: out });
  } catch (err) {
    next(err);
  }
}

