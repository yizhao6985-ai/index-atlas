/**
 * 指数成分行情：历史日 / 时间窗预计算 / 仅实时 rt；热路径带短 TTL 内存缓存（非空时写入）。
 */
import type pg from "pg";

import type { MarketSnapshotResponse } from "../openapi.js";
import type { MarketWindow } from "../lib/marketWindow.js";
import { BFF_CACHE_TTL_MS } from "../config.js";
import { aggregateSnapshotMeta } from "../lib/snapshotMeta.js";
import {
  MARKET_EMPTY_DIAG_SQL,
  MARKET_ROLLUP_SQL,
  MARKET_SQL_HISTORICAL,
  MARKET_SQL_LIVE,
  MARKET_SQL_RT_ONLY,
} from "../sql/market.js";

type CacheEntry = { exp: number; body: MarketSnapshotResponse };
const marketCache = new Map<string, CacheEntry>();
const rtCache = new Map<string, CacheEntry>();

function optStr(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/**
 * `quotes_rt` 的 amount 在 worker 中应存「千元」= rt_k(元)/1000。
 * 历史或异常数据曾把 Tushare「元」原样当「千」写库，会放大 ~1000 倍、出现成交额>流通市值，甚至单日成交>全市值。
 * 在 circ_mv（元）可用时，若按「千」理解会使当日成交额(元) = amount*1000 相对于市值不合理，则把 amount 当作「元」并转为千元。
 */
function normalizeRtAmountQian(
  amountRaw: number,
  circMvYuan: number | null,
): number {
  if (!Number.isFinite(amountRaw) || amountRaw < 0) {
    return amountRaw;
  }
  const c =
    circMvYuan != null && Number.isFinite(circMvYuan) && circMvYuan > 0
      ? circMvYuan
      : null;
  const toQian = (yuan: number) => yuan / 1000;
  if (c != null) {
    const asTurnoverYuanIfQian = amountRaw * 1000;
    if (asTurnoverYuanIfQian > 50 * c) {
      return toQian(amountRaw);
    }
  }
  if (amountRaw >= 5e7) {
    return toQian(amountRaw);
  }
  return amountRaw;
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

function mapRowRt(row: Record<string, unknown>) {
  const base = mapRow(row);
  const circ = base.circMv;
  const am = base.amount;
  if (am == null) {
    return base;
  }
  return {
    ...base,
    amount: normalizeRtAmountQian(
      am,
      circ != null && Number.isFinite(circ) ? circ : null,
    ),
  };
}

/**
 * 拉取与 OpenAPI 一致的 MarketSnapshot 体。
 * - `historicalTd`：单日 quotes_daily
 * - 否则：预计算表 `window`；`1d` 且表无数据时回退为旧版 live（rt∪daily）查询
 */
export async function getMarketSnapshot(
  pool: pg.Pool,
  code: string,
  options: { historicalTd: string | null; window: MarketWindow },
): Promise<
  { kind: "ok"; body: MarketSnapshotResponse } | { kind: "not_found" }
> {
  const { historicalTd, window } = options;
  const cacheKey =
    historicalTd != null
      ? `${code}\t${historicalTd}\thist`
      : `${code}\t${window}\troll`;
  const now = Date.now();
  const hit = marketCache.get(cacheKey);
  if (hit && hit.exp > now) {
    return { kind: "ok", body: hit.body };
  }

  const idxCheck = await pool.query("SELECT 1 FROM indices WHERE code = $1", [
    code,
  ]);
  if (idxCheck.rowCount === 0) {
    return { kind: "not_found" };
  }

  let r: { rows: Record<string, unknown>[] };

  if (historicalTd != null) {
    r = await pool.query(MARKET_SQL_HISTORICAL, [code, historicalTd]);
  } else {
    r = await pool.query(MARKET_ROLLUP_SQL, [code, window]);
    if (r.rows.length === 0 && window === "1d") {
      r = await pool.query(MARKET_SQL_LIVE, [code]);
    }
  }

  if (r.rows.length === 0) {
    const d = await pool.query(MARKET_EMPTY_DIAG_SQL, [code]);
    const row = d.rows[0] as Record<string, string | number> | undefined;
    console.warn(
      "[market] no rows for %s window=%s tradeDate=%s — constituents=%s quotes_total=%s",
      code,
      historicalTd ?? window,
      historicalTd ?? "rollup",
      row?.constituents ?? "?",
      row?.quotes ?? "?",
    );
  }

  const rows = r.rows.map((row) => mapRow(row as Record<string, unknown>));
  const meta = aggregateSnapshotMeta(r.rows);
  const body: MarketSnapshotResponse = {
    indexCode: code,
    dataAsOf: meta.dataAsOf,
    tradeDate: meta.tradeDate,
    rows,
  };

  if (r.rows.length > 0) {
    marketCache.set(cacheKey, { exp: now + BFF_CACHE_TTL_MS, body });
  }
  return { kind: "ok", body };
}

/**
 * 仅 `quotes_rt` 的最新一行 per 成分，结构同 getMarketSnapshot。
 */
export async function getMarketSnapshotRt(
  pool: pg.Pool,
  code: string,
): Promise<
  { kind: "ok"; body: MarketSnapshotResponse } | { kind: "not_found" }
> {
  const cacheKey = `${code}\trt`;
  const now = Date.now();
  const hit = rtCache.get(cacheKey);
  if (hit && hit.exp > now) {
    return { kind: "ok", body: hit.body };
  }

  const idxCheck = await pool.query("SELECT 1 FROM indices WHERE code = $1", [
    code,
  ]);
  if (idxCheck.rowCount === 0) {
    return { kind: "not_found" };
  }

  const r = await pool.query(MARKET_SQL_RT_ONLY, [code]);
  const rows = r.rows.map((row) =>
    mapRowRt(row as unknown as Record<string, unknown>),
  );
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
  return { kind: "ok", body };
}
