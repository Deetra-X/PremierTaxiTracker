import { Router } from "express";

import {
  createUserController,
  listUsersController,
  resetUserPasswordController,
  updateUserController
} from "./users.controller.js";

export function usersAdminRoutes() {
  const r = Router();
  r.get("/", listUsersController);
  r.post("/", createUserController);
  r.patch("/:userId", updateUserController);
  r.post("/:userId/reset-password", resetUserPasswordController);
  return r;
}

