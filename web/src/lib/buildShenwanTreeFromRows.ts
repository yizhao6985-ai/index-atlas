import type { ConstituentQuoteRow } from "@/api/generated/types.gen";

/** 申万三级（叶子） */
export type ShenwanL3Item = { code: string; name: string };
/** 申万二级 */
export type ShenwanL2Node = {
  code: string;
  name: string;
  children: ShenwanL3Item[];
};
/** 申万一级 */
export type ShenwanL1Node = {
  code: string;
  name: string;
  children: ShenwanL2Node[];
};

export type ShenwanTaxonomyTree = ShenwanL1Node[];

function normCode(v: unknown): string {
  if (v == null) return "";
  const t = String(v).trim();
  return t;
}

function normName(v: unknown): string {
  if (v == null) return "未分类";
  const t = String(v).trim();
  return t || "未分类";
}

type L3Agg = { code: string; name: string };
type L2Agg = { code: string; name: string; l3Map: Map<string, L3Agg> };
type L1Agg = { code: string; name: string; l2Map: Map<string, L2Agg> };

function cmpCodeName(
  a: { code: string; name: string },
  b: { code: string; name: string },
) {
  const ca = a.code;
  const cb = b.code;
  if (ca !== cb) return ca.localeCompare(cb, "zh-Hans-CN");
  return a.name.localeCompare(b.name, "zh-Hans-CN");
}

function materializeTree(l1Map: Map<string, L1Agg>): ShenwanTaxonomyTree {
  const l1s = [...l1Map.values()].sort(cmpCodeName);
  return l1s.map((l1) => ({
    code: l1.code,
    name: l1.name,
    children: [...l1.l2Map.values()].sort(cmpCodeName).map((l2) => ({
      code: l2.code,
      name: l2.name,
      children: [...l2.l3Map.values()].sort(cmpCodeName),
    })),
  }));
}

/**
 * 由 `market/rt` 返回的行情行聚合申万 L1→L2→L3 树（与后端 DISTINCT + Map 逻辑一致）。
 */
export function buildShenwanTreeFromQuoteRows(
  rows: ConstituentQuoteRow[],
): ShenwanTaxonomyTree {
  const l1Map = new Map<string, L1Agg>();

  for (const row of rows) {
    const l1c = normCode(row.swL1Code);
    const l1n = normName(row.swL1Name);
    const k1 = `${l1c}\t${l1n}`;
    let l1 = l1Map.get(k1);
    if (!l1) {
      l1 = { code: l1c, name: l1n, l2Map: new Map() };
      l1Map.set(k1, l1);
    }

    const l2c = normCode(row.swL2Code);
    const l2n = normName(row.swL2Name);
    const k2 = `${l2c}\t${l2n}`;
    let l2 = l1.l2Map.get(k2);
    if (!l2) {
      l2 = { code: l2c, name: l2n, l3Map: new Map() };
      l1.l2Map.set(k2, l2);
    }

    const l3c = normCode(row.swL3Code);
    const l3n = normName(row.swL3Name);
    const k3 = `${l3c}\t${l3n}`;
    if (!l2.l3Map.has(k3)) {
      l2.l3Map.set(k3, { code: l3c, name: l3n });
    }
  }

  return materializeTree(l1Map);
}
