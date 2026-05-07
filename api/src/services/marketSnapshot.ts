/**
 * 指数成分 `/market/rt`：
 * - **仅当该指数当前这批成分**在 `quotes_rt` 中至少有一条快照时走 rt 合并（有 rt 则用 rt，否则补缺用日线）。
 * - 否则（表中无这批代码的 rt，或已 TRUNCATE）：仅用 `quotes_daily` 各成分最新交易日。
 */
import type pg from "pg";

import type { MarketSnapshotResponse } from "../openapi.js";
import {
  type MarketRowSortBy,
  type MarketRowSortOrder,
  sortMarketSnapshotRows,
} from "../lib/marketRowSort.js";
import { BFF_CACHE_TTL_MS } from "../config.js";
import { aggregateSnapshotMeta } from "../lib/snapshotMeta.js";
import {
  MARKET_EMPTY_DIAG_SQL,
  MARKET_SQL_DAILY_FALLBACK,
  MARKET_SQL_QUOTES_RT_EXISTS_FOR_INDEX,
  MARKET_SQL_RT_MERGE,
} from "../sql/market.js";

type CacheEntry = { exp: number; body: MarketSnapshotResponse };
const rtCache = new Map<string, CacheEntry>();

function optStr(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function mapRow(row: Record<string, unknown>) {
  return {
    tsCode: row.tsCode as string,
    name: row.name as string,
    circMv: row.circMv != null ? Number(row.circMv) : null,
    amount: row.amount != null ? Number(row.amount) : null,
    pctChange: row.pctChange != null ? Number(row.pctChange) : null,
    snapshotAt: row.snapshotAt
      ? new Date(row.snapshotAt as Date | string).toISOString()
      : null,
    tradeDate: row.tradeDate
      ? String(row.tradeDate).length >= 10
        ? String(row.tradeDate).slice(0, 10)
        : new Date(row.tradeDate as Date).toISOString().slice(0, 10)
      : null,
    weight: row.weight != null ? Number(row.weight) : null,
    swL1Code: optStr(row.swL1Code),
    swL1Name: optStr(row.swL1Name),
    swL2Code: optStr(row.swL2Code),
    swL2Name: optStr(row.swL2Name),
    swL3Code: optStr(row.swL3Code),
    swL3Name: optStr(row.swL3Name),
  };
}

function withSortedRows(
  body: MarketSnapshotResponse,
  sortBy: MarketRowSortBy | null,
  sortOrder: MarketRowSortOrder,
): MarketSnapshotResponse {
  if (sortBy == null) return body;
  return {
    ...body,
    rows: sortMarketSnapshotRows(body.rows, sortBy, sortOrder),
  };
}

export async function getMarketSnapshotRt(
  pool: pg.Pool,
  code: string,
  options: { sortBy: MarketRowSortBy | null; sortOrder: MarketRowSortOrder },
): Promise<
  { kind: "ok"; body: MarketSnapshotResponse } | { kind: "not_found" }
> {
  const { sortBy, sortOrder } = options;

  const idxCheck = await pool.query("SELECT 1 FROM indices WHERE code = $1", [
    code,
  ]);
  if (idxCheck.rowCount === 0) {
    return { kind: "not_found" };
  }

  const ex = await pool.query(MARKET_SQL_QUOTES_RT_EXISTS_FOR_INDEX, [code]);
  const quotesRtNonEmpty = Boolean(
    (ex.rows[0] as { has_rt?: boolean } | undefined)?.has_rt,
  );
  const branch = quotesRtNonEmpty ? "rtmerge" : "daily";
  const cacheKey = `${code}\trt:${branch}`;
  const now = Date.now();
  const hit = rtCache.get(cacheKey);
  if (hit && hit.exp > now) {
    return { kind: "ok", body: withSortedRows(hit.body, sortBy, sortOrder) };
  }

  const sql = quotesRtNonEmpty
    ? MARKET_SQL_RT_MERGE
    : MARKET_SQL_DAILY_FALLBACK;
  const r = await pool.query(sql, [code]);

  if (r.rows.length === 0) {
    const d = await pool.query(MARKET_EMPTY_DIAG_SQL, [code]);
    const row = d.rows[0] as Record<string, string | number> | undefined;
    console.warn(
      "[market/rt] no rows for %s — constituents=%s quotes_total=%s",
      code,
      row?.constituents ?? "?",
      row?.quotes ?? "?",
    );
  }

  const rows = r.rows.map((row) => mapRow(row as unknown as Record<string, unknown>));
  const meta = aggregateSnapshotMeta(
    r.rows as { snapshotAt?: Date; tradeDate?: Date }[],
  );
  const body: MarketSnapshotResponse = {
    indexCode: code,
    dataAsOf: meta.dataAsOf,
    tradeDate: meta.tradeDate,
    rows,
  };
  if (r.rows.length > 0) {
    rtCache.set(cacheKey, { exp: now + BFF_CACHE_TTL_MS, body });
  }
  return { kind: "ok", body: withSortedRows(body, sortBy, sortOrder) };
}
