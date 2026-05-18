import { type UseQueryResult } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  IndicesResponse,
  MarketSnapshotResponse,
} from "@/api/generated/types.gen";
import { useIndexCatalog } from "@/hooks/useIndexCatalog";
import { useMarketSnapshotQueryFromDeps } from "@/hooks/useMarketSnapshotQuery";
import { useTradingSession } from "@/hooks/useTradingSession";
import type { Metric } from "@/lib/metric";
import { rowMatchesShenwanSelection } from "@/lib/shenwanCascader";

type AppStateValue = {
  indexCode: string;
  setIndexCode: (code: string) => void;
  metric: Metric;
  setMetric: (m: Metric) => void;
  /**
   * 申万级联选中路径（每层为 `encodeSwPart`）；空数组表示不筛选、展示当前指数全部成分。
   */
  shenwanCascaderPath: string[];
  setShenwanCascaderPath: (path: string[]) => void;
  /**
   * `/api/session` 成功后的 `continuousAuction`；未完成或失败时为 `undefined`。
   */
  continuousAuction: boolean | undefined;
  /**
   * 是否连续竞价：仅以已成功返回的 session 为准；未就绪前为 `false`。
   */
  isTrading: boolean;
  /**
   * `true` 表示 `/api/session` 已成功返回。在此之前 **`market/rt` 不应发起请求**。
   */
  canRequestRt: boolean;
  /** `GET /api/indices/catalog`（由 {@link useIndexCatalog} 拉取）。 */
  indicesData: IndicesResponse | undefined;
  /** `GET …/market/rt`。 */
  marketQuery: UseQueryResult<MarketSnapshotResponse, Error>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

export function useAppState(): AppStateValue {
  const v = useContext(AppStateContext);
  if (!v) throw new Error("useAppState must be used within AppStateProvider");
  return v;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [metric, setMetric] = useState<Metric>("mcap");
  const [shenwanCascaderPath, setShenwanCascaderPath] = useState<string[]>([]);

  const catalog = useIndexCatalog();
  const session = useTradingSession();

  useEffect(() => {
    setShenwanCascaderPath([]);
  }, [catalog.indexCode]);

  const marketQuery = useMarketSnapshotQueryFromDeps({
    indexCode: catalog.indexCode,
    metric,
    isTrading: session.isTrading,
    continuousAuction: session.continuousAuction,
    canRequestRt: session.canRequestRt,
  });

  const marketAlertedRef = useRef(false);
  useEffect(() => {
    if (marketQuery.isError && !marketAlertedRef.current) {
      marketAlertedRef.current = true;
      window.alert("加载市场数据失败，请确认 API 与数据库已有快照数据");
    }
    if (!marketQuery.isError) marketAlertedRef.current = false;
  }, [marketQuery.isError]);

  useEffect(() => {
    const rows = marketQuery.data?.rows;
    setShenwanCascaderPath((path) => {
      if (!path.length) return path;
      if (!rows?.length) return [];
      const ok = rows.some((r) => rowMatchesShenwanSelection(r, path));
      return ok ? path : [];
    });
  }, [marketQuery.data?.rows]);

  const value = useMemo(
    () => ({
      indexCode: catalog.indexCode,
      setIndexCode: catalog.setIndexCode,
      metric,
      setMetric,
      shenwanCascaderPath,
      setShenwanCascaderPath,
      continuousAuction: session.continuousAuction,
      isTrading: session.isTrading,
      canRequestRt: session.canRequestRt,
      indicesData: catalog.indicesData,
      marketQuery,
    }),
    [
      catalog.indexCode,
      catalog.setIndexCode,
      catalog.indicesData,
      metric,
      shenwanCascaderPath,
      session.continuousAuction,
      session.isTrading,
      session.canRequestRt,
      marketQuery,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}
