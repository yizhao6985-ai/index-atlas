import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getMarketSnapshotRt } from "@/api/generated/sdk.gen";
import type { Metric } from "@/lib/metric";

export type MarketRtQueryDeps = {
  indexCode: string;
  metric: Metric;
  isTrading: boolean;
  continuousAuction: boolean | undefined;
  canRequestRt: boolean;
};

const RT_POLL_MS = 10_000;

/**
 * `GET …/market/rt`，须在 `canRequestRt === true` 后才会请求。
 * 由 `AppStateProvider` 统一下发依赖；不要在子组件里重复订阅。
 */
export function useMarketSnapshotQueryFromDeps({
  indexCode,
  metric,
  isTrading,
  continuousAuction,
  canRequestRt,
}: MarketRtQueryDeps) {
  const q = useQuery({
    queryKey: ["market", "live", indexCode, metric],
    enabled: canRequestRt,
    queryFn: async () => {
      const res = await getMarketSnapshotRt({
        path: { code: indexCode },
        query: { sortBy: metric },
      });
      if (res.error) throw new Error(`market/rt ${JSON.stringify(res.error)}`);
      if (res.data === undefined) throw new Error("market/rt: empty body");
      return res.data;
    },
    refetchInterval: isTrading ? RT_POLL_MS : false,
    staleTime: isTrading ? 0 : Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: isTrading,
    refetchOnReconnect: isTrading,
  });

  const prevAuction = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (continuousAuction === undefined) return;
    if (prevAuction.current === continuousAuction) return;
    prevAuction.current = continuousAuction;
    void q.refetch();
  }, [continuousAuction, q.refetch]);

  return q;
}
