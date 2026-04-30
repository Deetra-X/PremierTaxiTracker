import { Router } from "express";

import { requireJwt } from "../middleware/jwt.middleware.js";
import {
  historyByIdController,
  historyController,
  liveSearchController,
  liveViewController
} from "../modules/tracking/tracking.controller.js";

export function trackingRoutes() {
  const r = Router();
  r.use(requireJwt);

  r.get("/live", liveViewController);
  r.get("/live-search", liveSearchController);
  r.get("/history", historyController);
  r.get("/history/:tukTukId", historyByIdController);

  return r;
}

