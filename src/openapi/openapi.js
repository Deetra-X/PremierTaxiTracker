export function buildOpenApiSpec() {
  const ApiError = {
    type: "object",
    additionalProperties: true,
    properties: {
      ok: { type: "boolean", example: false },
      error: {
        type: "object",
        additionalProperties: true,
        properties: {
          message: { type: "string" },
          code: { type: "string" }
        }
      }
    }
  };

  const ApiOk = (dataSchema) => ({
    type: "object",
    additionalProperties: false,
    properties: {
      ok: { type: "boolean", example: true },
      data: dataSchema ?? {}
    },
    required: ["ok", "data"]
  });

  const IntIdParam = (name, description) => ({
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "integer", minimum: 1 }
  });

  return {
    openapi: "3.0.3",
    info: {
      title: "Tuk-Tuk API",
      version: "1.0.0",
      description: "REST API for real-time tuk-tuk tracking and movement logging"
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Tracking" },
      { name: "Device" },
      { name: "Admin" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        },
        deviceApiKey: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key"
        }
      },
      schemas: {
        ApiError,
        LoginRequest: {
          type: "object",
          additionalProperties: false,
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 }
          }
        },
        LoginResponseData: {
          type: "object",
          additionalProperties: true,
          properties: {
            token: { type: "string" }
          }
        },
        DevicePingRequest: {
          type: "object",
          additionalProperties: false,
          required: ["tukTukId", "latitude", "longitude"],
          properties: {
            tukTukId: { type: "integer", minimum: 1 },
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
            speedKmh: { type: "number", minimum: 0, maximum: 250 },
            recordedAt: {
              type: "string",
              format: "date-time",
              description: "Optional device timestamp; must not be more than five minutes in the future."
            },
            locationDescription: { type: "string", maxLength: 255 }
          }
        }
      }
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          parameters: [
            {
              name: "If-None-Match",
              in: "header",
              required: false,
              description: "Weak ETag from a previous GET; returns 304 when unchanged.",
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "OK",
              headers: {
                ETag: { schema: { type: "string" } },
                "Cache-Control": { schema: { type: "string" } }
              },
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["ok"],
                    properties: { ok: { type: "boolean", example: true } }
                  }
                }
              }
            },
            304: {
              description: "Not Modified — body empty; reuse cached JSON from prior 200.",
              headers: {
                ETag: { schema: { type: "string" } },
                "Cache-Control": { schema: { type: "string" } }
              }
            }
          }
        }
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login (JWT)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" }
              }
            }
          },
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: ApiOk({ $ref: "#/components/schemas/LoginResponseData" })
                }
              }
            },
            400: {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            },
            401: {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            }
          }
        }
      },
      "/api/tracking/live": {
        get: {
          tags: ["Tracking"],
          summary: "Live view (last known location per tuk-tuk)",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "provinceId",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1 }
            },
            {
              name: "districtId",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1 }
            },
            {
              name: "stationId",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1 }
            }
          ],
          responses: {
            200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } },
            400: {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            },
            401: {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            }
          }
        }
      },
      "/api/tracking/live-search": {
        get: {
          tags: ["Tracking"],
          summary: "Search live location by plate / driver NIC / driver name",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2, maxLength: 80 } },
            { name: "provinceId", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            { name: "districtId", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            { name: "stationId", in: "query", required: false, schema: { type: "integer", minimum: 1 } }
          ],
          responses: {
            200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } },
            400: {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            },
            401: {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            }
          }
        }
      },
      "/api/tracking/history": {
        get: {
          tags: ["Tracking"],
          summary: "History (movement logs)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "tukTukId", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            { name: "from", in: "query", required: false, schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", required: false, schema: { type: "string", format: "date-time" } },
            { name: "provinceId", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            { name: "districtId", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            { name: "stationId", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
            {
              name: "sortBy",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["recordedAt", "logId", "tukTukId"], default: "recordedAt" }
            },
            {
              name: "sortOrder",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["asc", "desc"], default: "desc" }
            },
            {
              name: "If-None-Match",
              in: "header",
              required: false,
              description: "Weak ETag from a prior identical GET (same URL + authorization scope).",
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "OK",
              headers: {
                ETag: { schema: { type: "string" } },
                "Cache-Control": { schema: { type: "string" } },
                Vary: { schema: { type: "string", example: "Authorization" } }
              },
              content: { "application/json": { schema: ApiOk({}) } }
            },
            304: {
              description: "Not Modified",
              headers: {
                ETag: { schema: { type: "string" } },
                "Cache-Control": { schema: { type: "string" } },
                Vary: { schema: { type: "string" } }
              }
            },
            400: {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            },
            401: {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            }
          }
        }
      },
      "/api/tracking/history/{tukTukId}": {
        get: {
          tags: ["Tracking"],
          summary: "History for one tuk-tuk (optional date range)",
          description:
            "Returns movement logs for the given **tukTukId** only. Use query params **from** and **to** (ISO 8601 date-time) to restrict **recorded_at** inclusively (`recorded_at >= from` and `recorded_at <= to`). Omit both for all logs (up to server limit). Latest-first: use sortBy **recordedAt** and sortOrder **desc** (defaults).",
          security: [{ bearerAuth: [] }],
          parameters: [
            IntIdParam("tukTukId", "Tuk-tuk id (vehicle primary key)"),
            {
              name: "from",
              in: "query",
              required: false,
              description: "Start of time window (inclusive). Filters on location_logs.recorded_at.",
              schema: { type: "string", format: "date-time" },
              example: "2026-01-01T00:00:00.000Z"
            },
            {
              name: "to",
              in: "query",
              required: false,
              description: "End of time window (inclusive). Filters on location_logs.recorded_at.",
              schema: { type: "string", format: "date-time" },
              example: "2026-01-31T23:59:59.999Z"
            },
            {
              name: "provinceId",
              in: "query",
              required: false,
              description: "Optional extra geo filter (must sit within caller scope).",
              schema: { type: "integer", minimum: 1 }
            },
            {
              name: "districtId",
              in: "query",
              required: false,
              description: "Optional extra geo filter (must sit within caller scope).",
              schema: { type: "integer", minimum: 1 }
            },
            {
              name: "stationId",
              in: "query",
              required: false,
              description: "Optional extra geo filter (must sit within caller scope).",
              schema: { type: "integer", minimum: 1 }
            },
            {
              name: "sortBy",
              in: "query",
              required: false,
              description: "Sort field for log rows.",
              schema: { type: "string", enum: ["recordedAt", "logId", "tukTukId"], default: "recordedAt" }
            },
            {
              name: "sortOrder",
              in: "query",
              required: false,
              description: "Sort direction.",
              schema: { type: "string", enum: ["asc", "desc"], default: "desc" }
            },
            {
              name: "If-None-Match",
              in: "header",
              required: false,
              description: "Weak ETag from a prior identical GET (same URL + authorization scope).",
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "OK",
              headers: {
                ETag: { schema: { type: "string" } },
                Vary: { schema: { type: "string" } }
              },
              content: { "application/json": { schema: ApiOk({}) } }
            },
            304: { description: "Not Modified", headers: { ETag: { schema: { type: "string" } } } },
            400: {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            },
            401: {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            }
          }
        }
      },
      "/api/device/pings": {
        post: {
          tags: ["Device"],
          summary: "Ingest device ping (location log)",
          security: [{ deviceApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/DevicePingRequest" } }
            }
          },
          responses: {
            201: { description: "Created", content: { "application/json": { schema: ApiOk({}) } } },
            400: {
              description: "Validation error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            },
            401: {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            },
            403: {
              description: "Forbidden",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } }
            }
          }
        }
      },

      "/api/admin/provinces": {
        get: {
          tags: ["Admin"],
          summary: "List provinces",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "sortBy",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["provinceId", "name", "createdAt"], default: "provinceId" }
            },
            {
              name: "sortOrder",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["asc", "desc"], default: "asc" }
            },
            {
              name: "If-None-Match",
              in: "header",
              required: false,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "OK",
              headers: {
                ETag: { schema: { type: "string" } },
                Vary: { schema: { type: "string" } }
              },
              content: { "application/json": { schema: ApiOk({}) } }
            },
            304: { description: "Not Modified", headers: { ETag: { schema: { type: "string" } } } }
          }
        },
        post: {
          tags: ["Admin"],
          summary: "Create province (HQ_ADMIN only)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } }
          },
          responses: { 201: { description: "Created", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/provinces/{provinceId}": {
        patch: {
          tags: ["Admin"],
          summary: "Update province (HQ_ADMIN only)",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("provinceId", "Province id")],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } } } } }
          },
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },

      "/api/admin/districts": {
        get: {
          tags: ["Admin"],
          summary: "List districts (optionally filter by provinceId)",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "provinceId", in: "query", required: false, schema: { type: "integer", minimum: 1 } }],
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        },
        post: {
          tags: ["Admin"],
          summary: "Create district",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 201: { description: "Created", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/districts/{districtId}": {
        patch: {
          tags: ["Admin"],
          summary: "Update district",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("districtId", "District id")],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },

      "/api/admin/stations": {
        get: {
          tags: ["Admin"],
          summary: "List stations (optionally filter by districtId)",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "districtId", in: "query", required: false, schema: { type: "integer", minimum: 1 } }],
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        },
        post: {
          tags: ["Admin"],
          summary: "Create station",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 201: { description: "Created", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/stations/{stationId}": {
        patch: {
          tags: ["Admin"],
          summary: "Update station",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("stationId", "Station id")],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },

      "/api/admin/drivers": {
        get: {
          tags: ["Admin"],
          summary: "List drivers",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        },
        post: {
          tags: ["Admin"],
          summary: "Create driver",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 201: { description: "Created", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/drivers/{driverId}": {
        patch: {
          tags: ["Admin"],
          summary: "Update driver",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("driverId", "Driver id")],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },

      "/api/admin/devices": {
        get: {
          tags: ["Admin"],
          summary: "List GPS devices",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        },
        post: {
          tags: ["Admin"],
          summary: "Create GPS device",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 201: { description: "Created", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/devices/{deviceId}": {
        patch: {
          tags: ["Admin"],
          summary: "Update GPS device",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("deviceId", "Device id")],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/devices/{deviceId}/rotate-key": {
        post: {
          tags: ["Admin"],
          summary: "Rotate GPS device API key",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("deviceId", "Device id")],
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },

      "/api/admin/tuk-tuks": {
        get: {
          tags: ["Admin"],
          summary: "List tuk-tuks",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "sortBy",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["tukTukId", "registrationNumber", "registeredAt", "provinceId", "districtId"],
                default: "tukTukId"
              }
            },
            {
              name: "sortOrder",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["asc", "desc"], default: "asc" }
            },
            {
              name: "If-None-Match",
              in: "header",
              required: false,
              schema: { type: "string" }
            }
          ],
          responses: {
            200: {
              description: "OK",
              headers: {
                ETag: { schema: { type: "string" } },
                Vary: { schema: { type: "string" } }
              },
              content: { "application/json": { schema: ApiOk({}) } }
            },
            304: { description: "Not Modified", headers: { ETag: { schema: { type: "string" } } } }
          }
        },
        post: {
          tags: ["Admin"],
          summary: "Create tuk-tuk",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 201: { description: "Created", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/tuk-tuks/{tukTukId}": {
        patch: {
          tags: ["Admin"],
          summary: "Update tuk-tuk",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("tukTukId", "Tuk-tuk id")],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },

      "/api/admin/users": {
        get: {
          tags: ["Admin"],
          summary: "List users",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        },
        post: {
          tags: ["Admin"],
          summary: "Create user",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 201: { description: "Created", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/users/{userId}": {
        patch: {
          tags: ["Admin"],
          summary: "Update user",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("userId", "User id")],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      },
      "/api/admin/users/{userId}/reset-password": {
        post: {
          tags: ["Admin"],
          summary: "Reset user password (HQ_ADMIN only)",
          security: [{ bearerAuth: [] }],
          parameters: [IntIdParam("userId", "User id")],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { password: { type: "string", minLength: 6 } }, required: ["password"] } } } },
          responses: { 200: { description: "OK", content: { "application/json": { schema: ApiOk({}) } } } }
        }
      }
    }
  };
}

