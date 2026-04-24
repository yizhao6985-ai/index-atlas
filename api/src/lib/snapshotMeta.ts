/**
 * 从多行行情里汇总「整体截至时间」与「代表交易日」：取 `snapshotAt` 最大、`tradeDate` 最大。
 * 供响应里的 `dataAsOf` / `tradeDate`（ISO 日期与日历日各一种约定）。
 */
function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function aggregateSnapshotMeta(
  rows: {
    snapshotAt?: Date | string | null | unknown;
    tradeDate?: Date | string | null | unknown;
  }[],
): { dataAsOf: string | null; tradeDate: string | null } {
  let maxSnap: Date | null = null;
  let maxTd: Date | null = null;
  for (const r of rows) {
    const s = toDate(r.snapshotAt ?? null);
    if (s) {
      if (!maxSnap || s > maxSnap) maxSnap = s;
    }
    const t = toDate(r.tradeDate ?? null);
    if (t) {
      if (!maxTd || t > maxTd) maxTd = t;
    }
  }
  return {
    dataAsOf: maxSnap ? maxSnap.toISOString() : null,
    tradeDate: maxTd ? maxTd.toISOString().slice(0, 10) : null,
  };
}
