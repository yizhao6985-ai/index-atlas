/**
 * 解析查询参数 `tradeDate`：缺省或空串表示「非历史模式」；否则须为 `YYYY-MM-DD`。
 * 与 OpenAPI query 描述一致，非法格式由路由返回 `400 bad_trade_date`。
 */
export function parseOptionalTradeDate(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false };
  const t = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(t)) return { ok: false };
  return { ok: true, value: raw };
}
