import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import { getEnv } from "./config/env.js";
import { apiErrorHandler } from "./middleware/error.middleware.js";
import { createRateLimiters } from "./middleware/rateLimit.middleware.js";
import { requireJwt } from "./middleware/jwt.middleware.js";
import { requireRoles } from "./middleware/rbac.middleware.js";
import { routes } from "./routes/index.js";
import { buildOpenApiSpec } from "./openapi/openapi.js";
import { sendJsonConditional } from "./utils/httpConditionalJson.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  const corsOriginsRaw = getEnv("CORS_ORIGIN", { defaultValue: "" }).trim();
  const corsOrigins =
    corsOriginsRaw === ""
      ? []
      : corsOriginsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  app.use(cors({ origin: corsOrigins.length ? corsOrigins : false })); // default-deny unless configured
  app.use(express.json({ limit: "1mb" }));
  const nodeEnv = getEnv("NODE_ENV", { defaultValue: "development" });
  if (nodeEnv !== "production") {
    app.use(morgan("dev"));
  }

  const limits = createRateLimiters();
  app.use(limits.global);

  app.get("/health", (req, res) =>
    sendJsonConditional(req, res, { ok: true }, {
      vary: [],
      cacheControl: "public, max-age=0, must-revalidate"
    })
  );

  const enableDocs =
    getEnv("ENABLE_API_DOCS", { defaultValue: nodeEnv === "production" ? "false" : "true" }) ===
    "true";
  if (enableDocs) {
    const openapi = buildOpenApiSpec();
    const publicDocs =
      getEnv("PUBLIC_API_DOCS", { defaultValue: "false" }).toLowerCase() === "true";

    // In production, default is HQ-only unless explicitly made public (CW/demo)
    if (nodeEnv === "production") {
      if (publicDocs) {
        app.get("/api/openapi.json", (_req, res) => res.json(openapi));
        app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }));
      } else {
        app.get(
          "/api/openapi.json",
          requireJwt,
          requireRoles("HQ_ADMIN"),
          (_req, res) => res.json(openapi)
        );
        app.use(
          "/api/docs",
          requireJwt,
          requireRoles("HQ_ADMIN"),
          swaggerUi.serve,
          swaggerUi.setup(openapi, { explorer: true })
        );
      }
    } else {
      app.get("/api/openapi.json", (_req, res) => res.json(openapi));
      app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }));
    }
  }

  app.use("/api", routes(limits));

  app.use(apiErrorHandler);

  return app;
}

