import { Router } from "express";

import {
  createStationController,
  listStationsController,
  updateStationController
} from "./stations.controller.js";

export function stationsAdminRoutes() {
  const r = Router();
  r.get("/", listStationsController);
  r.post("/", createStationController);
  r.patch("/:stationId", updateStationController);
  return r;
}

