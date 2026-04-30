import { Router } from "express";

import {
  createProvinceController,
  listProvincesController,
  updateProvinceController
} from "./provinces.controller.js";

export function provincesAdminRoutes() {
  const r = Router();
  r.get("/", listProvincesController);
  r.post("/", createProvinceController);
  r.patch("/:provinceId", updateProvinceController);
  return r;
}

