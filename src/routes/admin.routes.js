import { Router } from "express";

import { requireJwt } from "../middleware/jwt.middleware.js";
import { requireRoles } from "../middleware/rbac.middleware.js";

import { provincesAdminRoutes } from "../modules/admin/provinces/provinces.routes.js";
import { districtsAdminRoutes } from "../modules/admin/districts/districts.routes.js";
import { stationsAdminRoutes } from "../modules/admin/stations/stations.routes.js";
import { driversAdminRoutes } from "../modules/admin/drivers/drivers.routes.js";
import { devicesAdminRoutes } from "../modules/admin/devices/devices.routes.js";
import { tukTuksAdminRoutes } from "../modules/admin/tukTuks/tukTuks.routes.js";
import { usersAdminRoutes } from "../modules/admin/users/users.routes.js";

export function adminRoutes() {
  const r = Router();
  r.use(requireJwt);
  r.use(requireRoles("HQ_ADMIN", "PROVINCIAL_OFFICER"));

  r.use("/provinces", provincesAdminRoutes());
  r.use("/districts", districtsAdminRoutes());
  r.use("/stations", stationsAdminRoutes());
  r.use("/drivers", requireRoles("HQ_ADMIN"), driversAdminRoutes());
  r.use("/devices", requireRoles("HQ_ADMIN"), devicesAdminRoutes());
  r.use("/tuk-tuks", tukTuksAdminRoutes());
  r.use("/users", usersAdminRoutes());

  return r;
}

