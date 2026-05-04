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
  const [isTrading, setIsTrading] = useState(() => isTradingSessionSimple());

  useEffect(() => {
    const id = window.setInterval(
      () => setIsTrading(isTradingSessionSimple()),
      30_000,
    );
    return () => clearInterval(id);
  }, []);

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
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}
