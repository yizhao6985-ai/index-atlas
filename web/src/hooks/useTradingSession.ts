import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";

import type { TradingSessionResponse } from "@/api/generated/types.gen";

export type TradingSessionDerived = {
  /** `/api/session` 成功后的 `continuousAuction`；未完成或失败时为 `undefined`。 */
  continuousAuction: boolean | undefined;
  /**
   * `true` 表示 `/api/session` 已成功返回。在此之前 **`market/rt` 不应发起请求**。
   */
  canRequestRt: boolean;
  /** 是否连续竞价：仅以已成功返回的 session 为准；未就绪前为 `false`。 */
  isTrading: boolean;
};

export type TradingSessionHookValue = TradingSessionDerived & {
  sessionQuery: UseQueryResult<TradingSessionResponse, Error>;
};

/**
 * `GET /api/session`：边界定时 refetch、失败后重试、`continuousAuction` / `canRequestRt` 等派生字段。
 */
export function useTradingSession(): TradingSessionHookValue {
  const sessionQuery = useQuery({
    queryKey: ["api", "session"],
    queryFn: async (): Promise<TradingSessionResponse> => {
      const res = await fetch("/api/session");
      if (!res.ok) throw new Error(`session_http_${res.status}`);
      return res.json();
    },
    staleTime: 0,
    refetchInterval: false,
    retry: 1,
  });

  /** 按 `nextSessionBoundaryAt` 再次拉 session（午休、收盘、次日开盘等）。 */
  useEffect(() => {
    const boundaryIso = sessionQuery.data?.nextSessionBoundaryAt;
    if (!boundaryIso || sessionQuery.isFetching) return;

    const ts = Date.parse(boundaryIso);
    if (!Number.isFinite(ts)) return;

    const delayFromBoundary = Math.max(0, ts - Date.now()) + 300;
    const capped = Math.min(delayFromBoundary, 2 ** 31 - 2);
    const id = window.setTimeout(() => void sessionQuery.refetch(), capped);
    return () => window.clearTimeout(id);
  }, [
    sessionQuery.data?.nextSessionBoundaryAt,
    sessionQuery.isFetching,
    sessionQuery.refetch,
  ]);

  useEffect(() => {
    if (!sessionQuery.isError) return;
    const id = window.setInterval(() => void sessionQuery.refetch(), 30_000);
    return () => window.clearInterval(id);
  }, [sessionQuery.isError, sessionQuery.refetch]);

  const continuousAuction = sessionQuery.data?.continuousAuction;
  const canRequestRt = sessionQuery.isSuccess;
  const isTrading =
    sessionQuery.isSuccess && sessionQuery.data != null
      ? sessionQuery.data.continuousAuction
      : false;

  return { sessionQuery, continuousAuction, canRequestRt, isTrading };
}
