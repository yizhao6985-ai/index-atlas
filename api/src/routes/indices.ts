/**
 * 指数目录 HTTP：`GET /api/indices/catalog`。
 * 大盘行情见 `routes/market.ts`，同前缀挂载时须本 router 先注册。
 */
import { Router } from "express";
import type pg from "pg";

import { fetchIndicesList } from "../services/indices.js";

export function createIndicesRouter(pool: pg.Pool) {
  const router = Router();

  router.get("/catalog", async (_req, res) => {
    try {
      const body = await fetchIndicesList(pool);
      res.json(body);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "db_error" });
    }
  });

  return router;
}
