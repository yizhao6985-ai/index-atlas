import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getMarketSnapshotRt, listIndices } from "@/api/generated/sdk.gen";
import { useAppState } from "@/context/AppStateContext";
import { formatDataAsOf } from "@/lib/formatDate";

/**
 * 壳层用到的指数列表 + 大盘 RT 行情，以及默认指数初始化、市场加载失败时弹窗提示。
 */
export function useAppShellData() {
  const { indexCode, setIndexCode, isTrading, metric } = useAppState();

  const indexInitRef = useRef(false);
  const { data: indicesData } = useQuery({
    queryKey: ["indices"],
    queryFn: async () => {
      const res = await listIndices();
      if (res.error) throw new Error(`indices ${JSON.stringify(res.error)}`);
      if (res.data === undefined) throw new Error("indices: empty body");
      return res.data;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    const d = indicesData?.defaultCode;
    if (d && !indexInitRef.current) {
      setIndexCode(d);
      indexInitRef.current = true;
    }
  }, [indicesData?.defaultCode, setIndexCode]);

  const marketQuery = useQuery({
    queryKey: ["market", "rt", indexCode, metric],
    queryFn: async () => {
      const res = await getMarketSnapshotRt({
        path: { code: indexCode },
        query: { sortBy: metric },
      });
      if (res.error) throw new Error(`market/rt ${JSON.stringify(res.error)}`);
      if (res.data === undefined) throw new Error("market/rt: empty body");
      return res.data;
    },
    refetchInterval: () => (isTrading ? 10_000 : false),
  });

  const marketAlertedRef = useRef(false);
  useEffect(() => {
    if (marketQuery.isError && !marketAlertedRef.current) {
      marketAlertedRef.current = true;
      window.alert("加载市场数据失败，请确认 API 与数据库已有快照数据");
    }
    if (!marketQuery.isError) marketAlertedRef.current = false;
  }, [marketQuery.isError]);

  return {
    indicesData,
    marketQuery,
    dataAsOfDisplay: formatDataAsOf(marketQuery.data?.dataAsOf),
    tradeDate: marketQuery.data?.tradeDate,
  };
}
