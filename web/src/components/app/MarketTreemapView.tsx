import { useMemo } from "react";

import TreemapChart from "@/components/TreemapChart";
import ShenwanTierBreadcrumb from "@/components/app/ShenwanTierBreadcrumb";
import { useAppState } from "@/context/AppStateContext";
import { buildShenwanTreemapTree, rowsToFlat } from "@/lib/treemapBuilder";
import { rowMatchesShenwanSelection } from "@/lib/shenwanCascader";

/**
 * 主内容区：指数行情快照 + 申万 treemap。
 */
export default function MarketTreemapView() {
  const {
    metric,
    canRequestRt,
    marketQuery,
    shenwanCascaderPath,
    setShenwanCascaderPath,
  } = useAppState();

  const tree = useMemo(() => {
    const rows = marketQuery.data?.rows;
    if (!rows?.length) return null;
    const filtered =
      shenwanCascaderPath.length > 0
        ? rows.filter((r) => rowMatchesShenwanSelection(r, shenwanCascaderPath))
        : rows;
    if (!filtered.length) return null;
    return buildShenwanTreemapTree(rowsToFlat(filtered), metric, "all");
  }, [marketQuery.data?.rows, metric, shenwanCascaderPath]);

  const pending = !canRequestRt || marketQuery.isPending;
  const hasTree = tree && (tree.children?.length ?? 0) > 0;
  const rawCount = marketQuery.data?.rows?.length ?? 0;
  const filteredEmpty =
    !pending && rawCount > 0 && shenwanCascaderPath.length > 0 && !hasTree;

  return (
    <div
      className={`relative box-border flex min-h-0 w-full min-w-0 flex-1 flex-col px-0 py-0 pb-[env(safe-area-inset-bottom,0px)] sm:px-0 sm:py-2 sm:pb-3 ${
        pending
          ? "after:pointer-events-none after:absolute after:inset-0 after:bg-white/45"
          : ""
      }`}
    >
      <ShenwanTierBreadcrumb
        selectedPath={shenwanCascaderPath}
        onNavigatePrefix={setShenwanCascaderPath}
        className={pending ? "pointer-events-none opacity-60" : ""}
      />
      {hasTree ? (
        <TreemapChart
          root={tree}
          onSwCascaderPathSelect={setShenwanCascaderPath}
        />
      ) : null}
      {!pending && !hasTree ? (
        <div className="flex min-h-[200px] flex-1 items-center justify-center px-3 text-center">
          <p className="m-0 text-sm text-slate-500">
            {filteredEmpty
              ? "当前申万筛选下无成分：请调整级联选择或点击清除恢复全部"
              : "暂无数据：请先运行 worker 写入成分与行情快照"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
