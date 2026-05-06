/**
 * 指数相关 HTTP：`GET /api/indices` 与 `GET /api/indices/:code/market`。
 * OpenAPI 在 `src/openapi-spec/`（Zod）中注册，入口见 `src/openapi.ts`。
 */
import { Router } from "express";
import type pg from "pg";

import { parseOptionalMarketWindow } from "../lib/marketWindow.js";
import { fetchIndicesList } from "../services/indices.js";
import { getMarketSnapshot, getMarketSnapshotRt } from "../services/marketSnapshot.js";
import { parseOptionalTradeDate } from "../lib/tradeDate.js";
import { parseOptionalMarketRowSort } from "../lib/marketRowSort.js";

export function createIndicesRouter(pool: pg.Pool) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const body = await fetchIndicesList(pool);
      res.json(body);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "db_error" });
    }
  });

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

  router.get("/:code/market", async (req, res) => {
    const code = req.params.code;
    const tdParsed = parseOptionalTradeDate(req.query.tradeDate);
    if (!tdParsed.ok) {
      res.status(400).json({ error: "bad_trade_date" });
      return;
    }
    const wParsed = parseOptionalMarketWindow(req.query.window);
    if (!wParsed.ok) {
      res.status(400).json({ error: "bad_window" });
      return;
    }
    const sortParsed = parseOptionalMarketRowSort(
      req.query as Record<string, unknown>,
    );
    if (!sortParsed.ok) {
      res.status(400).json({ error: "bad_sort" });
      return;
    }
    try {
      const out = await getMarketSnapshot(pool, code, {
        historicalTd: tdParsed.value,
        window: wParsed.value,
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
