import type { ConstituentQuoteRow } from "@/api/generated/types.gen";
import type { DefaultOptionType } from "antd/es/cascader";

import type { ShenwanTaxonomyTree } from "@/lib/buildShenwanTreeFromRows";

const SEP = "\x1f";

/** 级联第一项「全部」（叶子）；与 encodeSwPart 取值域隔离，不会 collision。 */
export const SW_CASCADER_VALUE_ALL_LEAF = "__SW_CASCADER_ALL__";

/** 下拉展示用：选中一级 / 二级 / 三级时在标签上带的层级前缀。 */
export const SHENWAN_DRILL_LABELS = ["一级", "二级", "三级"] as const;

export function encodeSwPart(code: string, name: string): string {
  return `${code}${SEP}${encodeURIComponent(name)}`;
}

export function decodeSwPart(v: string): { code: string; name: string } {
  if (v === SW_CASCADER_VALUE_ALL_LEAF) {
    return { code: "", name: "全部" };
  }
  const i = v.indexOf(SEP);
  if (i < 0) {
    const code = v.trim();
    return { code, name: "未分类" };
  }
  const rawName = decodeURIComponent(v.slice(i + SEP.length));
  return {
    code: v.slice(0, i).trim(),
    name: rawName ? rawName : "未分类",
  };
}

/** 按申万路径筛选行情行；`selectedPath` 为 Cascader 已选各层的 encodeSwPart 值。 */
export function rowMatchesShenwanSelection(
  row: ConstituentQuoteRow,
  selectedPath: string[] | null | undefined,
): boolean {
  if (!selectedPath?.length) return true;
  const parts = selectedPath.map(decodeSwPart);
  const rn = (code: unknown, name: unknown) => ({
    code: code != null && String(code).trim() !== "" ? String(code).trim() : "",
    name:
      name != null && String(name).trim() !== ""
        ? String(name).trim()
        : "未分类",
  });
  const r1 = rn(row.swL1Code, row.swL1Name);
  if (parts[0].code !== r1.code || parts[0].name !== r1.name) return false;
  if (parts.length < 2) return true;
  const r2 = rn(row.swL2Code, row.swL2Name);
  if (parts[1].code !== r2.code || parts[1].name !== r2.name) return false;
  if (parts.length < 3) return true;
  const r3 = rn(row.swL3Code, row.swL3Name);
  return parts[2].code === r3.code && parts[2].name === r3.name;
}

export function shenwanTreeToCascaderOptions(
  tree: ShenwanTaxonomyTree,
): DefaultOptionType[] {
  return tree.map((l1) => ({
    value: encodeSwPart(l1.code, l1.name),
    label: l1.code ? `${l1.name} (${l1.code})` : l1.name,
    children: l1.children.map((l2) => ({
      value: encodeSwPart(l2.code, l2.name),
      label: l2.code ? `${l2.name} (${l2.code})` : l2.name,
      children: l2.children.map((l3) => ({
        value: encodeSwPart(l3.code, l3.name),
        label: l3.code ? `${l3.name} (${l3.code})` : l3.name,
      })),
    })),
  }));
}

/**
 * 优化后级联：第一列左侧为「全部」（叶子）；其余为第一级 industry，下钻依次为二、三级。
 */
export function shenwanTreeToTieredRootCascaderOptions(
  tree: ShenwanTaxonomyTree,
): DefaultOptionType[] {
  const allLeaf: DefaultOptionType = {
    value: SW_CASCADER_VALUE_ALL_LEAF,
    label: "全部 · 不按申万筛选",
  };
  const rest = shenwanTreeToCascaderOptions(tree);
  return rest.length === 0 ? [allLeaf] : [allLeaf, ...rest];
}

/** Cascader `onChange` 结果转成存储用路径（不包含「全部」哨兵）。 */
export function storagePathFromCascaderChange(selected: unknown): string[] {
  if (!selected || !Array.isArray(selected)) return [];
  const raw = selected.filter(Boolean) as string[];
  const head = raw[0];
  if (head === SW_CASCADER_VALUE_ALL_LEAF) return [];
  return raw.filter((x) => x !== SW_CASCADER_VALUE_ALL_LEAF);
}

export function shenwanPathDisplayChunks(
  path: string[],
): { tierIdx: number; label: string }[] {
  return path.map((segment, tierIdx) => ({
    tierIdx,
    label:
      tierIdx >= 0 && tierIdx < SHENWAN_DRILL_LABELS.length
        ? `${SHENWAN_DRILL_LABELS[tierIdx]} · ${decodeSwPart(segment).name}`
        : decodeSwPart(segment).name,
  }));
}

/** 控件内单行文案（占位 / 摘要）。 */
export function shenwanCascaderDisplayText(path: string[]): string {
  if (!path.length) return "";
  const chunks = shenwanPathDisplayChunks(path);
  return chunks.map((c) => c.label).join(" › ");
}
