import { Router } from "express";

import {
  createDeviceController,
  listDevicesController,
  rotateDeviceKeyController,
  updateDeviceController
} from "./devices.controller.js";

export function devicesAdminRoutes() {
  const r = Router();
  r.get("/", listDevicesController);
  r.post("/", createDeviceController);
  r.patch("/:deviceId", updateDeviceController);
  r.post("/:deviceId/rotate-key", rotateDeviceKeyController);
  return r;
}

