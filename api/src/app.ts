/**
 * Express 应用工厂：注册中间件、OpenAPI/文档 与业务路由，不含 `listen`。
 * 测试或脚本可 `createApp(pool)` 得到 app 后自行挂载/监听。
 */
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import type pg from "pg";

import { getOpenApiDocument } from "./openapi.js";
import { healthRouter } from "./routes/health.js";
import { createIndicesRouter } from "./routes/indices.js";
import { createSessionRouter } from "./routes/session.js";

/** 组装完整 BFF；OpenAPI 由 `openapi-spec/` + 入口 `openapi.ts` 生成。 */
export function createApp(pool: pg.Pool) {
  const app = express();
  app.use(cors());

  // 契约与文档
  const openApiDocument = getOpenApiDocument();
  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Index Atlas API",
    }),
  );

  app.use("/health", healthRouter);
  app.use("/api", createSessionRouter(pool));
  app.use("/api/indices", createIndicesRouter(pool));

  return app;
}
