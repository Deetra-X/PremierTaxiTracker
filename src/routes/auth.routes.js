import { Router } from "express";

import { loginController } from "../modules/auth/auth.controller.js";

export function authRoutes() {
  const r = Router();
  r.post("/login", loginController);
  return r;
}

