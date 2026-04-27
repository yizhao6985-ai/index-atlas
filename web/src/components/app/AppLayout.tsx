import AppHeader from "@/components/app/AppHeader";
import DisclaimerBanner from "@/components/app/DisclaimerBanner";
import MarketLoadErrorBar from "@/components/app/MarketLoadErrorBar";
import MarketTreemapView from "@/components/app/MarketTreemapView";
import { useAppShellData } from "@/hooks/useAppShellData";
import { useAppState } from "@/context/AppStateContext";

/** 全局壳：免责条、错误条、顶栏、treemap 主内容。 */
export default function AppLayout() {
  const { indexCode, setIndexCode, metric, setMetric, isTrading } =
    useAppState();
  const { indicesData, marketQuery, dataAsOfDisplay, tradeDate } =
    useAppShellData();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100/90 pb-[env(safe-area-inset-bottom,0px)] sm:pt-[env(safe-area-inset-top,0px)]">
      <div className="max-sm:hidden">
        <DisclaimerBanner />
      </div>
      <MarketLoadErrorBar show={marketQuery.isError} />
      <AppHeader
        indexCode={indexCode}
        setIndexCode={setIndexCode}
        metric={metric}
        onMetricChange={setMetric}
        indicesData={indicesData}
        tradeDate={tradeDate}
        dataAsOfDisplay={dataAsOfDisplay}
        isTrading={isTrading}
        marketIsRefetching={marketQuery.isRefetching}
        marketDataUpdatedAt={marketQuery.dataUpdatedAt}
        marketRows={marketQuery.data?.rows}
      />
      <main className="m-0 flex min-h-0 w-full max-w-none flex-1 flex-col overflow-x-hidden p-0 max-sm:pt-[calc(env(safe-area-inset-top,0px)+var(--app-mobile-header-bar-h))]">
        <MarketTreemapView />
      </main>
    </div>
  );
}
