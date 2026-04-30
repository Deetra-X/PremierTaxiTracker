import { Router } from "express";

import {
  createDistrictController,
  listDistrictsController,
  updateDistrictController
} from "./districts.controller.js";

export function districtsAdminRoutes() {
  const r = Router();
  r.get("/", listDistrictsController);
  r.post("/", createDistrictController);
  r.patch("/:districtId", updateDistrictController);
  return r;
}

