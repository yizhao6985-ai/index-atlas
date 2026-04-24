import type { ConstituentQuoteRow } from "@/api/generated/types.gen";

import type { Metric } from "@/lib/metric";

export interface TreemapNode {
  name: string;
  value?: number;
  tsCode?: string | null;
  pctChange?: number | null;
  /** 流通市值（万元），仅叶子 */
  circMv?: number | null;
  /** 成交额（千元），仅叶子 */
  amount?: number | null;
  /** 指数成分权重，仅叶子 */
  weight?: number | null;
  children?: TreemapNode[];
}

export interface FlatRow {
  tsCode: string;
  name: string;
  circMv: number | null;
  amount: number | null;
  pctChange: number | null;
  /** 指数成分权重（百分比等，来自 index_constituents） */
  weight: number | null;
  /** 申万 L1–L3（无数据为 null，用于行业分层 treemap） */
  swL1Code: string | null;
  swL1Name: string | null;
  swL2Code: string | null;
  swL2Name: string | null;
  swL3Code: string | null;
  swL3Name: string | null;
}

function optName(v: string | null | undefined): string {
  const t = v?.trim();
  return t ? t : "未分类";
}

export function rowsToFlat(rows: ConstituentQuoteRow[]): FlatRow[] {
  return rows.map((r) => ({
    tsCode: r.tsCode,
    name: r.name,
    circMv: r.circMv ?? null,
    amount: r.amount ?? null,
    pctChange: r.pctChange ?? null,
    weight: r.weight != null && !Number.isNaN(Number(r.weight)) ? Number(r.weight) : null,
    swL1Code: r.swL1Code ?? null,
    swL1Name: r.swL1Name ?? null,
    swL2Code: r.swL2Code ?? null,
    swL2Name: r.swL2Name ?? null,
    swL3Code: r.swL3Code ?? null,
    swL3Name: r.swL3Name ?? null,
  }));
}

function metricValue(row: FlatRow, metric: Metric): number {
  let raw: number | null;
  if (metric === "mcap") {
    const cm = row.circMv;
    raw =
      cm != null && !Number.isNaN(Number(cm)) && Number(cm) > 0
        ? Number(cm)
        : row.amount;
  } else if (metric === "turnover") {
    raw = row.amount;
  } else {
    raw = row.weight;
  }
  const n = raw == null || Number.isNaN(raw) ? 0 : Number(raw);
  return Math.max(n, 0);
}

function ensureChild(parent: TreemapNode, name: string): TreemapNode {
  if (!parent.children) parent.children = [];
  let n = parent.children.find((c) => c.name === name);
  if (!n) {
    n = { name, children: [] };
    parent.children.push(n);
  }
  return n;
}

/**
 * 申万 L1 → L2 → L3 → 成分股 四层嵌套；面积在末级股票上，再向上汇总结点 `value`。
 */
export function buildShenwanTreemapTree(rows: FlatRow[], metric: Metric): TreemapNode {
  const root: TreemapNode = { name: "root", children: [] };

  for (const row of rows) {
    const v = metricValue(row, metric);
    if (v <= 0) continue;

    const l1 = optName(row.swL1Name);
    const l2 = optName(row.swL2Name);
    const l3 = optName(row.swL3Name);

    const n1 = ensureChild(root, l1);
    const n2 = ensureChild(n1, l2);
    const n3 = ensureChild(n2, l3);
    if (!n3.children) n3.children = [];
    n3.children.push({
      name: row.name || row.tsCode,
      value: v,
      tsCode: row.tsCode,
      pctChange: row.pctChange,
      circMv: row.circMv,
      amount: row.amount,
      weight: row.weight,
    });
  }

  root.children = root.children?.filter(pruneEmptyBranches) ?? [];
  rollupValues(root);
  return root;
}

/** 扁平热力图：根下直接为各成分股（不按行业分层）。 */
export function buildTreemapTree(rows: FlatRow[], metric: Metric): TreemapNode {
  const root: TreemapNode = { name: "root", children: [] };

  for (const row of rows) {
    const v = metricValue(row, metric);
    if (v <= 0) continue;

    root.children!.push({
      name: row.name || row.tsCode,
      value: v,
      tsCode: row.tsCode,
      pctChange: row.pctChange,
      circMv: row.circMv,
      amount: row.amount,
      weight: row.weight,
    });
  }

  root.children = root.children?.filter(pruneEmptyBranches) ?? [];
  rollupValues(root);
  return root;
}

function pruneEmptyBranches(node: TreemapNode): boolean {
  if (node.children && node.children.length > 0) {
    node.children = node.children.filter(pruneEmptyBranches);
    return node.children.length > 0;
  }
  return (node.value ?? 0) > 0;
}

/**
 * 汇总面积 `value`；有子级时按子节点面积对涨跌幅做加权平均，供 treemap
 * 非叶块、合并后仍属父级展示时的配色与 `colorForPctChange` 一致。
 */
function rollupValues(node: TreemapNode): number {
  if (node.children && node.children.length > 0) {
    let s = 0;
    let weightedPct = 0;
    let wSum = 0;
    for (const c of node.children) {
      const v = rollupValues(c);
      s += v;
      const p = c.pctChange;
      if (p != null && !Number.isNaN(Number(p)) && v > 0) {
        weightedPct += Number(p) * v;
        wSum += v;
      }
    }
    node.value = s;
    node.pctChange = wSum > 0 ? weightedPct / wSum : null;
    return s;
  }
  return node.value ?? 0;
}
