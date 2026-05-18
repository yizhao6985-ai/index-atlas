import type { ConstituentQuoteRow } from "@/api/generated/types.gen";

import type { Metric } from "@/lib/metric";
import { encodeSwPart } from "@/lib/shenwanCascader";

export interface TreemapNode {
  name: string;
  value?: number;
  tsCode?: string | null;
  pctChange?: number | null;
  /** 自由流通市值（元），仅叶子 */
  circMv?: number | null;
  /** 成交额（千元），仅叶子 */
  amount?: number | null;
  /** 指数成分权重，仅叶子 */
  weight?: number | null;
  /**
   * 申万级联路径（与顶部 Cascader 的 value 一致，每层 `encodeSwPart`）；
   * 行业层与股票叶子均带满路径 L1→L2→L3，便于点击云图同步筛选。
   */
  swCascaderPath?: string[];
  children?: TreemapNode[];
}

/** 申万行业在 treemap 中展开到哪一层；`all` 为 L1→L2→L3→成分股（默认）。 */
export type ShenwanTreemapDepth = "all" | "l1" | "l2" | "l3";

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

function normCode(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v).trim();
}

function cmpZh(a: string, b: string): number {
  return a.localeCompare(b, "zh-Hans-CN");
}

export function rowsToFlat(rows: ConstituentQuoteRow[]): FlatRow[] {
  return rows.map((r) => ({
    tsCode: r.tsCode,
    name: r.name,
    circMv: r.circMv ?? null,
    amount: r.amount ?? null,
    pctChange: r.pctChange ?? null,
    weight:
      r.weight != null && !Number.isNaN(Number(r.weight))
        ? Number(r.weight)
        : null,
    swL1Code: r.swL1Code ?? null,
    swL1Name: r.swL1Name ?? null,
    swL2Code: r.swL2Code ?? null,
    swL2Name: r.swL2Name ?? null,
    swL3Code: r.swL3Code ?? null,
    swL3Name: r.swL3Name ?? null,
  }));
}

type Agg = { v: number; wp: number; w: number };

function bumpAgg(a: Agg, row: FlatRow, v: number): void {
  a.v += v;
  const p = row.pctChange;
  if (p != null && !Number.isNaN(Number(p)) && v > 0) {
    a.wp += Number(p) * v;
    a.w += v;
  }
}

function aggToLeaf(name: string, a: Agg): TreemapNode {
  return {
    name,
    value: a.v,
    pctChange: a.w > 0 ? a.wp / a.w : null,
  };
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

/** 与 {@link encodeSwPart} 对齐的申万节点；同名合并时沿用首次写入的路径。 */
function ensureChildWithSw(
  parent: TreemapNode,
  displayName: string,
  swPath: string[],
): TreemapNode {
  if (!parent.children) parent.children = [];
  let n = parent.children.find((c) => c.name === displayName);
  if (!n) {
    n = { name: displayName, children: [], swCascaderPath: [...swPath] };
    parent.children.push(n);
  } else if (!n.swCascaderPath?.length) {
    n.swCascaderPath = [...swPath];
  }
  return n;
}

/**
 * 申万 L1 → L2 → L3 → 成分股 四层嵌套；面积在末级股票上，再向上汇总结点 `value`。
 */
function buildShenwanTreemapTreeFull(
  rows: FlatRow[],
  metric: Metric,
): TreemapNode {
  const root: TreemapNode = { name: "root", children: [] };

  for (const row of rows) {
    const v = metricValue(row, metric);
    if (v <= 0) continue;

    const l1 = optName(row.swL1Name);
    const l2 = optName(row.swL2Name);
    const l3 = optName(row.swL3Name);
    const c1 = encodeSwPart(normCode(row.swL1Code), l1);
    const c2 = encodeSwPart(normCode(row.swL2Code), l2);
    const c3 = encodeSwPart(normCode(row.swL3Code), l3);
    const swFull = [c1, c2, c3];

    const n1 = ensureChildWithSw(root, l1, [c1]);
    const n2 = ensureChildWithSw(n1, l2, [c1, c2]);
    const n3 = ensureChildWithSw(n2, l3, swFull);
    if (!n3.children) n3.children = [];
    n3.children.push({
      name: row.name || row.tsCode,
      value: v,
      tsCode: row.tsCode,
      pctChange: row.pctChange,
      circMv: row.circMv,
      amount: row.amount,
      weight: row.weight,
      swCascaderPath: swFull,
    });
  }

  root.children = root.children?.filter(pruneEmptyBranches) ?? [];
  rollupValues(root);
  return root;
}

/** 仅按申万一级聚合（无下钻子级）。 */
function buildShenwanTreemapTreeL1(
  rows: FlatRow[],
  metric: Metric,
): TreemapNode {
  const m = new Map<string, Agg>();
  for (const row of rows) {
    const v = metricValue(row, metric);
    if (v <= 0) continue;
    const l1 = optName(row.swL1Name);
    let a = m.get(l1);
    if (!a) a = { v: 0, wp: 0, w: 0 };
    bumpAgg(a, row, v);
    m.set(l1, a);
  }
  const root: TreemapNode = {
    name: "root",
    children: [...m.entries()]
      .sort(([a], [b]) => cmpZh(a, b))
      .map(([name, a]) => aggToLeaf(name, a)),
  };
  root.children = root.children?.filter(pruneEmptyBranches) ?? [];
  rollupValues(root);
  return root;
}

/** 申万 L1 → L2，二级为聚合叶子（无 L3 / 股票）。 */
function buildShenwanTreemapTreeL2(
  rows: FlatRow[],
  metric: Metric,
): TreemapNode {
  const l1Map = new Map<string, Map<string, Agg>>();
  for (const row of rows) {
    const v = metricValue(row, metric);
    if (v <= 0) continue;
    const l1 = optName(row.swL1Name);
    const l2 = optName(row.swL2Name);
    let m2 = l1Map.get(l1);
    if (!m2) {
      m2 = new Map();
      l1Map.set(l1, m2);
    }
    let a = m2.get(l2);
    if (!a) a = { v: 0, wp: 0, w: 0 };
    bumpAgg(a, row, v);
    m2.set(l2, a);
  }
  const root: TreemapNode = { name: "root", children: [] };
  for (const l1 of [...l1Map.keys()].sort(cmpZh)) {
    const m2 = l1Map.get(l1)!;
    const n1: TreemapNode = {
      name: l1,
      children: [...m2.entries()]
        .sort(([a], [b]) => cmpZh(a, b))
        .map(([l2, a]) => aggToLeaf(l2, a)),
    };
    root.children!.push(n1);
  }
  root.children = root.children?.filter(pruneEmptyBranches) ?? [];
  rollupValues(root);
  return root;
}

/** 申万 L1 → L2 → L3，三级为聚合叶子（无股票）。 */
function buildShenwanTreemapTreeL3Agg(
  rows: FlatRow[],
  metric: Metric,
): TreemapNode {
  const top = new Map<string, Map<string, Map<string, Agg>>>();
  for (const row of rows) {
    const v = metricValue(row, metric);
    if (v <= 0) continue;
    const l1 = optName(row.swL1Name);
    const l2 = optName(row.swL2Name);
    const l3 = optName(row.swL3Name);
    let m2 = top.get(l1);
    if (!m2) {
      m2 = new Map();
      top.set(l1, m2);
    }
    let m3 = m2.get(l2);
    if (!m3) {
      m3 = new Map();
      m2.set(l2, m3);
    }
    let a = m3.get(l3);
    if (!a) a = { v: 0, wp: 0, w: 0 };
    bumpAgg(a, row, v);
    m3.set(l3, a);
  }
  const root: TreemapNode = { name: "root", children: [] };
  for (const l1 of [...top.keys()].sort(cmpZh)) {
    const m2 = top.get(l1)!;
    const n1: TreemapNode = { name: l1, children: [] };
    for (const l2 of [...m2.keys()].sort(cmpZh)) {
      const m3 = m2.get(l2)!;
      const n2: TreemapNode = {
        name: l2,
        children: [...m3.entries()]
          .sort(([a], [b]) => cmpZh(a, b))
          .map(([l3, a]) => aggToLeaf(l3, a)),
      };
      n1.children!.push(n2);
    }
    root.children!.push(n1);
  }
  root.children = root.children?.filter(pruneEmptyBranches) ?? [];
  rollupValues(root);
  return root;
}

/**
 * 申万分层 treemap：`depth` 控制聚合到一级 / 二级 / 三级行业或完整展开到成分股。
 */
export function buildShenwanTreemapTree(
  rows: FlatRow[],
  metric: Metric,
  depth: ShenwanTreemapDepth = "all",
): TreemapNode {
  if (depth === "l1") return buildShenwanTreemapTreeL1(rows, metric);
  if (depth === "l2") return buildShenwanTreemapTreeL2(rows, metric);
  if (depth === "l3") return buildShenwanTreemapTreeL3Agg(rows, metric);
  return buildShenwanTreemapTreeFull(rows, metric);
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
