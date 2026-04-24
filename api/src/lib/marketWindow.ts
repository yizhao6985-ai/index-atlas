export type MarketWindow = "1d" | "7d" | "30d";

const WIN = new Set<MarketWindow>(["1d", "7d", "30d"]);

/**
 * 解析 `?window=1d|7d|30d`；缺省为 1d。非法时返回 { ok: false }。
 */
export function parseOptionalMarketWindow(
  raw: string | string[] | undefined | unknown,
): { ok: true; value: MarketWindow } | { ok: false } {
  if (raw === undefined) return { ok: true, value: "1d" };
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s === undefined || s === "") return { ok: true, value: "1d" };
  const t = typeof s === "string" ? s : String(s);
  if (WIN.has(t as MarketWindow)) return { ok: true, value: t as MarketWindow };
  return { ok: false };
}
