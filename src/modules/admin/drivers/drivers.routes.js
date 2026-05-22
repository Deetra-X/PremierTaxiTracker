import { Router } from "express";

import {
  createDriverController,
  listDriversController,
  updateDriverController
} from "./drivers.controller.js";
import { requireRoles } from "../../../middleware/rbac.middleware.js";

export function driversAdminRoutes() {
  const r = Router();
  r.use(requireRoles("HQ_ADMIN"));
  r.get("/", listDriversController);
  r.post("/", createDriverController);
  r.patch("/:driverId", updateDriverController);
  return r;
}

