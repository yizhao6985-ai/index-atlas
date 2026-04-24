/**
 * 健康检查：供编排与负载均衡探活，无数据库依赖。
 * OpenAPI 在 `src/openapi-spec/`（Zod）中注册，入口见 `src/openapi.ts`。
 */
import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true });
});

export { router as healthRouter };
