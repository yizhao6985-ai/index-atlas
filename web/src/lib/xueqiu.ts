/**
 * 雪球个股页，例如：https://xueqiu.com/S/SH688256
 * `tsCode` 为 Tushare 风格：688256.SH、000001.SZ、430047.BJ
 */
export function xueqiuStockUrl(tsCode: string | null | undefined): string | null {
  if (tsCode == null || typeof tsCode !== "string") return null;
  const parts = tsCode.trim().split(".");
  if (parts.length !== 2) return null;
  const [code, suffix] = parts;
  if (!code || !suffix) return null;
  const mkt = suffix.toUpperCase();
  if (mkt !== "SH" && mkt !== "SZ" && mkt !== "BJ") return null;
  return `https://xueqiu.com/S/${mkt}${code}`;
}
