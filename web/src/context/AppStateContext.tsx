import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Metric } from "@/lib/metric";
import { isTradingSessionSimple } from "@/lib/tradingSession";

type TradingSessionPayload = {
  continuousAuction: boolean;
};

type AppStateValue = {
  indexCode: string;
  setIndexCode: (code: string) => void;
  metric: Metric;
  setMetric: (m: Metric) => void;
  isTrading: boolean;
};

const AppStateContext = createContext<AppStateValue | null>(null);

export function useAppState(): AppStateValue {
  const v = useContext(AppStateContext);
  if (!v) throw new Error("useAppState must be used within AppStateProvider");
  return v;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [indexCode, setIndexCode] = useState("000985.SH");
  const [metric, setMetric] = useState<Metric>("mcap");

  /** BFF 不可用时退回：仅剔除周末与上海墙钟，不含法定节假日与 SSE trade_calendar */
  const [clientFallbackTrading, setClientFallbackTrading] = useState(() =>
    isTradingSessionSimple(),
  );
  useEffect(() => {
    const id = window.setInterval(
      () => setClientFallbackTrading(isTradingSessionSimple()),
      60_000,
    );
    return () => window.clearInterval(id);
  }, []);

  const sessionQuery = useQuery({
    queryKey: ["api", "session"],
    queryFn: async (): Promise<TradingSessionPayload> => {
      const res = await fetch("/api/session");
      if (!res.ok) throw new Error(`session_http_${res.status}`);
      return res.json();
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: 1,
  });

  const isTrading =
    sessionQuery.data?.continuousAuction ?? clientFallbackTrading;

  const value = useMemo(
    () => ({
      indexCode,
      setIndexCode,
      metric,
      setMetric,
      isTrading,
    }),
    [indexCode, metric, isTrading],
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}
