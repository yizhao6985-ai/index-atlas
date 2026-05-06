import { Router } from "express";
import type pg from "pg";

import { getTradingSessionState } from "../services/tradingSessionState.js";

export function createSessionRouter(pool: pg.Pool) {
  const router = Router();

  router.get("/session", async (_req, res) => {
    try {
      const body = await getTradingSessionState(pool);
      res.json(body);
    } catch (e) {
      console.error("[api/session]", e);
      res.status(500).json({ error: "session_lookup_failed" });
    }
  });

  return router;
}
