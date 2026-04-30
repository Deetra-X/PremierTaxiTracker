import { z } from "zod";

import { createHttpError } from "../../../middleware/error.middleware.js";
import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser
} from "./users.service.js";

const RoleEnum = z.enum([
  "HQ_ADMIN",
  "PROVINCIAL_OFFICER",
  "DISTRICT_OFFICER",
  "STATION_OFFICER"
]);

const UserCreateSchema = z.object({
  fullName: z.string().min(1).max(150),
  email: z.string().email().max(150),
  role: RoleEnum,
  stationId: z.number().int().positive().nullable().optional(),
  password: z.string().min(6).max(200)
});

const UserUpdateSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  role: RoleEnum.optional(),
  stationId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional()
});

const ResetPasswordSchema = z.object({
  password: z.string().min(6).max(200)
});

export async function listUsersController(req, res, next) {
  try {
    const data = await listUsers({ user: req.user });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createUserController(req, res, next) {
  try {
    const parsed = UserCreateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await createUser({ user: req.user, input: parsed.data });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateUserController(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = UserUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await updateUser({ user: req.user, userId, input: parsed.data });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function resetUserPasswordController(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) throw createHttpError(400, "Invalid id", "VALIDATION_ERROR");
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw createHttpError(400, "Invalid payload", "VALIDATION_ERROR");
    const data = await resetUserPassword({ user: req.user, userId, password: parsed.data.password });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

