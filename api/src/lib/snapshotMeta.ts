/**
 * 从多行行情里汇总「整体截至时间」与「代表交易日」：取 `snapshotAt` 最大、`tradeDate` 最大。
 * 供响应里的 `dataAsOf` / `tradeDate`（ISO 日期与日历日各一种约定）。
 */
const SHANGHAI_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** 行情日按「上海自然日」YYYY-MM-DD，避免用 UTC 截取 `toISOString()` 导致与 `dataAsOf`（上海展示）差一天 */
function tradeDateShanghaiYmd(v: unknown): string | null {
  const d = toDate(v);
  if (!d) return null;
  return SHANGHAI_YMD.format(d);
}

export function aggregateSnapshotMeta(
  rows: {
    snapshotAt?: Date | string | null | unknown;
    tradeDate?: Date | string | null | unknown;
  }[],
): { dataAsOf: string | null; tradeDate: string | null } {
  let maxSnap: Date | null = null;
  let maxTdYmd: string | null = null;
  for (const r of rows) {
    const s = toDate(r.snapshotAt ?? null);
    if (s) {
      if (!maxSnap || s > maxSnap) maxSnap = s;
    }
    const ymd = tradeDateShanghaiYmd(r.tradeDate ?? null);
    if (ymd) {
      if (!maxTdYmd || ymd > maxTdYmd) maxTdYmd = ymd;
    }
  }
  return {
    dataAsOf: maxSnap ? maxSnap.toISOString() : null,
    tradeDate: maxTdYmd,
  };
}
