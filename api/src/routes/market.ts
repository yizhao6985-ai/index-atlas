/**
 * 大盘活体 HTTP：`GET /api/indices/:code/market/rt`（挂载在 `/api/indices`）。
 * 数据策略见 `getMarketSnapshotRt`：仅以「当前指数这批成分」是否在 `quotes_rt` 为准分支；聚合先限定这批标的。
 * 须与 `routes/indices` 一起注册，且 **indices 在前**，避免 `/:code` 误匹配 `/catalog`。
 */
import { Router } from "express";
import type pg from "pg";

import { parseOptionalMarketRowSort } from "../lib/marketRowSort.js";
import { getMarketSnapshotRt } from "../services/marketSnapshot.js";

export function createMarketRouter(pool: pg.Pool) {
  const router = Router();

  router.get("/:code/market/rt", async (req, res) => {
    const code = req.params.code;
    const sortParsed = parseOptionalMarketRowSort(
      req.query as Record<string, unknown>,
    );
    if (!sortParsed.ok) {
      res.status(400).json({ error: "bad_sort" });
      return;
    }
    try {
      const out = await getMarketSnapshotRt(pool, code, {
        sortBy: sortParsed.sortBy,
        sortOrder: sortParsed.sortOrder,
      });
      if (out.kind === "not_found") {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(out.body);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "db_error" });
    }
  });

  return router;
}
