/** 分档与 `bucketKeyForPct`、图例、热力图一致；配色为常见行情红涨 / 绿跌。 */

export function colorForPctChange(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "#9ca3af";

  // 跌：深绿 → 浅绿（绿跌）
  if (pct <= -8) return "#064e3b";
  if (pct <= -5) return "#047857";
  if (pct <= -2.5) return "#059669";
  if (pct <= -0.9) return "#34d399";
  if (pct < 0.9) return "#6b7280";
  // 涨：浅红 → 深红（红涨）
  if (pct < 2.5) return "#fca5a5";
  if (pct < 5) return "#f87171";
  if (pct < 8) return "#ef4444";
  return "#b91c1c";
}

/** 与 `colorForPctChange` / 图例档位一致，用于统计分布计数 */
export function bucketKeyForPct(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(Number(pct))) return "na";
  const p = Number(pct);
  if (p <= -8) return "down_extreme";
  if (p <= -5) return "down_strong";
  if (p <= -2.5) return "down_mid";
  if (p <= -0.9) return "down_light";
  if (p < 0.9) return "flat";
  if (p < 2.5) return "up_light";
  if (p < 5) return "up_mid";
  if (p < 8) return "up_strong";
  return "up_extreme";
}

/** 图例、统计表用完整区间；具体比例见顶栏 hover */
export const LEGEND_BUCKETS: { key: string; label: string; color: string }[] = [
  { key: "down_extreme", label: "≤ −8%", color: "#064e3b" },
  { key: "down_strong", label: "(−8, −5]", color: "#047857" },
  { key: "down_mid", label: "(−5, −2.5]", color: "#059669" },
  { key: "down_light", label: "(−2.5, −0.9]", color: "#34d399" },
  { key: "flat", label: "(−0.9, 0.9)", color: "#6b7280" },
  { key: "up_light", label: "[0.9, 2.5)", color: "#fca5a5" },
  { key: "up_mid", label: "[2.5, 5)", color: "#f87171" },
  { key: "up_strong", label: "[5, 8)", color: "#ef4444" },
  { key: "up_extreme", label: "≥ 8%", color: "#b91c1c" },
  { key: "na", label: "无数据", color: "#9ca3af" },
];
