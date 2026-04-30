import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import { apiErrorHandler } from "./middleware/error.middleware.js";
import { createRateLimiters } from "./middleware/rateLimit.middleware.js";
import { routes } from "./routes/index.js";
import { buildOpenApiSpec } from "./openapi/openapi.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: false })); // default-deny; set CORS_ORIGIN later if needed
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  const limits = createRateLimiters();
  app.use(limits.global);

  app.get("/health", (req, res) => res.json({ ok: true }));

  const openapi = buildOpenApiSpec();
  app.get("/api/openapi.json", (_req, res) => res.json(openapi));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }));

  app.use("/api", routes(limits));

  app.use(apiErrorHandler);

  return app;
}

