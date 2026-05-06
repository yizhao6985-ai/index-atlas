/**
 * 行情快照 `rows` 排序：与前端热力图「面积」维度一致（权重 / 成交额 / 自由流通市值）。
 */
export type MarketRowSortBy = "weight" | "turnover" | "mcap";
export type MarketRowSortOrder = "asc" | "desc";

const SORT_BY = new Set<MarketRowSortBy>(["weight", "turnover", "mcap"]);
const SORT_ORDER = new Set<MarketRowSortOrder>(["asc", "desc"]);

function firstString(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  if (Array.isArray(raw)) return firstString(raw[0]);
  if (typeof raw === "string") return raw;
  return String(raw);
}

type SortableQuoteRow = {
  tsCode: string;
  weight: number | null;
  amount: number | null;
  circMv: number | null;
};

/**
 * 解析 `sortBy`（对应面积维度）、`sortOrder`（默认 desc）。未传 `sortBy` 时不排序。
 */
export function parseOptionalMarketRowSort(query: {
  sortBy?: unknown;
  sortOrder?: unknown;
}):
  | { ok: true; sortBy: MarketRowSortBy | null; sortOrder: MarketRowSortOrder }
  | { ok: false } {
  const sb = firstString(query.sortBy);
  const soRaw = firstString(query.sortOrder);

  if (sb === undefined || sb === "") {
    if (
      soRaw !== undefined &&
      soRaw !== "" &&
      !SORT_ORDER.has(soRaw as MarketRowSortOrder)
    ) {
      return { ok: false };
    }
    return { ok: true, sortBy: null, sortOrder: "desc" };
  }

  if (!SORT_BY.has(sb as MarketRowSortBy)) return { ok: false };

  let sortOrder: MarketRowSortOrder = "desc";
  if (soRaw !== undefined && soRaw !== "") {
    if (!SORT_ORDER.has(soRaw as MarketRowSortOrder)) return { ok: false };
    sortOrder = soRaw as MarketRowSortOrder;
  }

  return { ok: true, sortBy: sb as MarketRowSortBy, sortOrder };
}

function metricValue(row: SortableQuoteRow, sortBy: MarketRowSortBy): number | null {
  switch (sortBy) {
    case "weight":
      return row.weight;
    case "turnover":
      return row.amount;
    case "mcap":
      return row.circMv;
  }
}

/** 稳定排序：数值相同再按 tsCode；null 靠后。 */
export function sortMarketSnapshotRows<R extends SortableQuoteRow>(
  rows: R[],
  sortBy: MarketRowSortBy,
  sortOrder: MarketRowSortOrder,
): R[] {
  const cmp = (a: R, b: R): number => {
    const na = metricValue(a, sortBy);
    const nb = metricValue(b, sortBy);
    if (na == null && nb == null) return a.tsCode.localeCompare(b.tsCode);
    if (na == null) return 1;
    if (nb == null) return -1;
    const d = sortOrder === "desc" ? nb - na : na - nb;
    if (d !== 0) return d;
    return a.tsCode.localeCompare(b.tsCode);
  };
  return rows.slice().sort(cmp);
}
