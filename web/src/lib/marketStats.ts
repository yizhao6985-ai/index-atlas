import type { ConstituentQuoteRow } from "@/api/generated/types.gen";

import { bucketKeyForPct } from "@/lib/colors";

/**
 * 热力图用的 circ_mv 原值在库内为**元**（free_share 万股×10000×收盘价），
 * 全市场合计转「万亿元」：元 / 1e12。
 */
export function totalCircMvToTrillionYuan(sumYuan: number): number {
  return sumYuan / 1e12;
}

/** amount 单位：千元；合计转「亿元」展示 */
export function totalAmountToYiYuan(sumQianYuan: number): number {
  return sumQianYuan / 1e5;
}

export interface MarketSummary {
  count: number;
  /** 有涨跌幅的样本数 */
  withPct: number;
  /** 等权平均涨跌幅 */
  avgPct: number | null;
  /** 上涨家数（>0.9%） */
  riseCount: number;
  /** 下跌家数（<-0.9%） */
  fallCount: number;
  /** 平盘（含无数据以外的 [-0.9,0.9]） */
  flatCount: number;
  /** 无涨跌幅 */
  naPctCount: number;
  /** 成分自由流通市值合计，单位：元 */
  totalCircMvWan: number;
  /** 成分成交额合计，单位：千元 */
  totalAmountQian: number;
  /** 与 `LEGEND_BUCKETS.key` 对齐 */
  distribution: Record<string, number>;
}

export function summarizeMarket(rows: ConstituentQuoteRow[]): MarketSummary {
  const distribution: Record<string, number> = {};
  let totalCircMvWan = 0;
  let totalAmountQian = 0;
  let sumPct = 0;
  let withPct = 0;
  let riseCount = 0;
  let fallCount = 0;
  let flatCount = 0;
  let naPctCount = 0;

  for (const r of rows) {
    const cm = r.circMv;
    if (cm != null && !Number.isNaN(Number(cm)) && Number(cm) > 0) {
      totalCircMvWan += Number(cm);
    }
    const am = r.amount;
    if (am != null && !Number.isNaN(Number(am)) && Number(am) > 0) {
      totalAmountQian += Number(am);
    }

    const p = r.pctChange;
    const key = bucketKeyForPct(p);
    distribution[key] = (distribution[key] ?? 0) + 1;

    if (p == null || Number.isNaN(Number(p))) {
      naPctCount++;
      continue;
    }
    const pv = Number(p);
    sumPct += pv;
    withPct++;
    if (pv > 0.9) riseCount++;
    else if (pv < -0.9) fallCount++;
    else flatCount++;
  }

  return {
    count: rows.length,
    withPct,
    avgPct: withPct > 0 ? sumPct / withPct : null,
    riseCount,
    fallCount,
    flatCount,
    naPctCount,
    totalCircMvWan,
    totalAmountQian,
    distribution,
  };
}
