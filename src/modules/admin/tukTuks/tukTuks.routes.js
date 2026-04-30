import { Router } from "express";

import {
  createTukTukController,
  listTukTuksController,
  updateTukTukController
} from "./tukTuks.controller.js";

export function tukTuksAdminRoutes() {
  const r = Router();
  r.get("/", listTukTuksController);
  r.post("/", createTukTukController);
  r.patch("/:tukTukId", updateTukTukController);
  return r;
}

