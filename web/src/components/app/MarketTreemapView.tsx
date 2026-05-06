import { useMemo } from "react";

import TreemapChart from "@/components/TreemapChart";
import { useMarketSnapshotQuery } from "@/hooks/useMarketSnapshotQuery";
import { useAppState } from "@/context/AppStateContext";
import { buildShenwanTreemapTree, rowsToFlat } from "@/lib/treemapBuilder";

/**
 * 主内容区：指数行情快照 + 申万 treemap。
 */
export default function MarketTreemapView() {
  const { metric } = useAppState();

  const marketQuery = useMarketSnapshotQuery();

  const tree = useMemo(() => {
    const rows = marketQuery.data?.rows;
    if (!rows?.length) return null;
    return buildShenwanTreemapTree(rowsToFlat(rows), metric);
  }, [marketQuery.data?.rows, metric]);

  const pending = marketQuery.isPending;
  const hasTree = tree && (tree.children?.length ?? 0) > 0;

  return (
    <div
      className={`relative box-border flex min-h-0 w-full min-w-0 flex-1 flex-col px-0 py-0 pb-[env(safe-area-inset-bottom,0px)] sm:px-0 sm:py-2 sm:pb-3 ${
        pending ? "after:pointer-events-none after:absolute after:inset-0 after:bg-white/45" : ""
      }`}
    >
      {hasTree ? <TreemapChart root={tree} /> : null}
      {!pending && !hasTree ? (
        <div className="flex min-h-[200px] flex-1 items-center justify-center">
          <p className="m-0 text-sm text-slate-500">
            暂无数据：请先运行 worker 写入成分与行情快照
          </p>
        </div>
      ) : null}
    </div>
  );
}
