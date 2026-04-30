import { Router } from "express";

import {
  createDriverController,
  listDriversController,
  updateDriverController
} from "./drivers.controller.js";

export function driversAdminRoutes() {
  const r = Router();
  r.get("/", listDriversController);
  r.post("/", createDriverController);
  r.patch("/:driverId", updateDriverController);
  return r;
}

