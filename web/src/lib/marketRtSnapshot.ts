import type { MarketSnapshotResponse } from "@/api/generated/types.gen";
import { formatDataAsOf } from "@/lib/formatDate";

/** 顶栏「交易日」：`/market/rt` 响应体字段 `tradeDate`（YYYY-MM-DD），不从 `rows` 聚合。 */
export function tradeDateLabelFromMarketRt(
  snapshot: MarketSnapshotResponse | undefined,
): string | null {
  const v = snapshot?.tradeDate;
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v).trim();
  if (!s) return null;
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** 顶栏「数据截至」：`/market/rt` 的 `dataAsOf`（ISO）经上海时区格式化，不从 `rows` 取 max。 */
export function dataAsOfDisplayFromMarketRt(
  snapshot: MarketSnapshotResponse | undefined,
): string {
  const v = snapshot?.dataAsOf;
  if (v == null || v === "") return "";
  const iso = typeof v === "string" ? v : String(v);
  return formatDataAsOf(iso);
}
