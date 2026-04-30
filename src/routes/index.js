import { Router } from "express";

import { authRoutes } from "../routes/auth.routes.js";
import { trackingRoutes } from "../routes/tracking.routes.js";
import { deviceRoutes } from "../routes/device.routes.js";

export function routes(limits) {
  const router = Router();

  router.use("/auth", limits.auth, authRoutes());
  router.use("/tracking", trackingRoutes());
  router.use("/device", limits.device, deviceRoutes());

  return router;
}

