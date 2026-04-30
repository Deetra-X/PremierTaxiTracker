import { Router } from "express";

import { requireDeviceApiKey } from "../middleware/deviceKey.middleware.js";
import { ingestPingController } from "../modules/device/device.controller.js";

export function deviceRoutes() {
  const r = Router();
  r.use(requireDeviceApiKey);

  r.post("/pings", ingestPingController);

  return r;
}

