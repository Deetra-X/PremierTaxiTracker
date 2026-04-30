import { Router } from "express";

import { requireJwt } from "../middleware/jwt.middleware.js";
import { liveViewController, historyController } from "../modules/tracking/tracking.controller.js";

export function trackingRoutes() {
  const r = Router();
  r.use(requireJwt);

  r.get("/live", liveViewController);
  r.get("/history", historyController);

  return r;
}

