import { CloseOutlined, LoadingOutlined, MenuOutlined } from "@ant-design/icons";
import { Button, Col, Popover, Radio, Row, Select, Space, Tag } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import UsageHelpModal from "@/components/app/UsageHelpModal";
import MarketStatsCharts from "@/components/MarketStatsCharts";
import { LEGEND_BUCKETS } from "@/lib/colors";
import type { Metric } from "@/lib/metric";
import {
  summarizeMarket,
  totalAmountToYiYuan,
  totalCircMvToTrillionYuan,
} from "@/lib/marketStats";
import type {
  ConstituentQuoteRow,
  IndicesResponse,
  MarketSnapshotResponse,
} from "@/api/generated/types.gen";
import {
  dataAsOfDisplayFromMarketRt,
  tradeDateLabelFromMarketRt,
} from "@/lib/marketRtSnapshot";

const METRIC_OPTIONS: readonly (readonly [Metric, string])[] = [
  ["mcap", "自由流通市值"],
  ["turnover", "成交额"],
  ["weight", "成分权重"],
] as const;

const MOBILE_DISCLAIMER =
  "个人学习演示，不构成投资建议；数据来自第三方，不保证准确完整。使用本页风险自负。";

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtNum(v: number, digits: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

type AppHeaderProps = {
  indexCode: string;
  setIndexCode: (code: string) => void;
  metric: Metric;
  onMetricChange: (m: Metric) => void;
  indicesData: IndicesResponse | undefined;
  /** `GET …/market/rt` 响应体；顶栏「交易日」「数据截至」仅读其 `tradeDate` / `dataAsOf`。 */
  marketSnapshot: MarketSnapshotResponse | undefined;
  isTrading: boolean;
  marketIsRefetching: boolean;
  marketDataUpdatedAt: number;
  marketRows: ConstituentQuoteRow[] | undefined;
};

export default function AppHeader({
  indexCode,
  setIndexCode,
  metric,
  onMetricChange,
  indicesData,
  marketSnapshot,
  isTrading,
  marketIsRefetching,
  marketDataUpdatedAt,
  marketRows,
}: AppHeaderProps) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [usageHelpOpen, setUsageHelpOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileSheetOpen(false), []);

  useEffect(() => {
    if (!mobileSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileSheetOpen, closeMobile]);

  useEffect(() => {
    if (typeof document === "undefined" || !mobileSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileSheetOpen]);

  const summary = useMemo(() => summarizeMarket(marketRows ?? []), [marketRows]);
  const distTable = useMemo(() => {
    const d = summary.distribution;
    return LEGEND_BUCKETS.map((b) => ({
      label: b.label,
      color: b.color,
      count: d[b.key] ?? 0,
    }));
  }, [summary.distribution]);

  const statsChartsPopover = useMemo(
    () => (
      <div className="p-1 sm:p-2">
        <MarketStatsCharts layout="popover" summary={summary} distRows={distTable} />
      </div>
    ),
    [summary, distTable],
  );

  const statsChartsBlock = useMemo(
    () => <MarketStatsCharts layout="mobile" summary={summary} distRows={distTable} />,
    [summary, distTable],
  );

  const [justUpdated, setJustUpdated] = useState(false);
  const prevUpdatedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!isTrading) {
      setJustUpdated(false);
      return;
    }
    const at = marketDataUpdatedAt;
    if (!at) return;
    if (prevUpdatedAt.current === null) {
      prevUpdatedAt.current = at;
      return;
    }
    if (at !== prevUpdatedAt.current) {
      prevUpdatedAt.current = at;
      setJustUpdated(true);
      const t = window.setTimeout(() => setJustUpdated(false), 1200);
      return () => window.clearTimeout(t);
    }
  }, [isTrading, marketDataUpdatedAt]);

  const indexOptions =
    (indicesData?.indices ?? []).length === 0
      ? [{ label: indexCode, value: indexCode }]
      : indicesData!.indices.map((i) => ({
          label: `${i.name} (${i.code})`,
          value: i.code,
        }));

  const hasRows = (marketRows?.length ?? 0) > 0;

  const tradeDateLabel = useMemo(
    () => tradeDateLabelFromMarketRt(marketSnapshot),
    [marketSnapshot],
  );
  const dataAsOfDisplay = useMemo(
    () => dataAsOfDisplayFromMarketRt(marketSnapshot),
    [marketSnapshot],
  );

  const metricSelectOptions = METRIC_OPTIONS.map(([val, label]) => ({
    value: val,
    label,
  }));

  const controlCluster = (opts: { mobile: boolean }) => (
    <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <Row gutter={[12, 12]} align="middle" wrap>
        <Col
          xs={24}
          md={5}
          lg={4}
          className={[
            "min-w-0 max-w-full",
            opts.mobile ? "" : "sm:max-w-[14rem]",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Row gutter={[8, 0]} align="middle" wrap={false} className="min-w-0">
            <Col flex="none">
              <span className="shrink-0 text-xs text-slate-500">指数</span>
            </Col>
            <Col flex="auto" className="min-w-0 max-w-full">
              <Select
                size="small"
                className="w-full min-w-0"
                value={indexCode}
                aria-label="当前指数"
                onChange={setIndexCode}
                options={indexOptions}
                popupMatchSelectWidth={false}
              />
            </Col>
          </Row>
        </Col>
        <Col xs={24} md={12} flex="1 1 280px" className="min-w-0 max-w-full">
          {opts.mobile ? (
            <Row gutter={[8, 0]} align="middle" wrap={false} className="min-w-0">
              <Col flex="none">
                <span className="shrink-0 text-xs text-slate-500">面积</span>
              </Col>
              <Col flex="auto" className="min-w-0 max-w-full">
                <Select
                  size="small"
                  className="w-full min-w-0"
                  value={metric}
                  aria-label="面积维度"
                  onChange={(v) => onMetricChange(v as Metric)}
                  options={metricSelectOptions}
                />
              </Col>
            </Row>
          ) : (
            <Row gutter={[10, 8]} align="middle" className="min-w-0 w-full" wrap>
              <Col flex="none">
                <span className="shrink-0 text-xs text-slate-500">面积</span>
              </Col>
              <Col flex="1 1 200px" className="min-w-0 max-w-full">
                <Radio.Group
                  value={metric}
                  onChange={(e) => onMetricChange(e.target.value as Metric)}
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                  options={metricSelectOptions}
                />
              </Col>
            </Row>
          )}
        </Col>
      </Row>
    </div>
  );

  const tagsAndStatusRow = (
    <Space size={[8, 6]} wrap align="start" className="w-full">
      {tradeDateLabel ? (
        <Tag className="m-0 max-w-full border-slate-200 bg-slate-100 text-slate-700 text-[11px] sm:text-xs">
          交易日 {tradeDateLabel}
        </Tag>
      ) : null}
      {dataAsOfDisplay ? (
        <Tag
          className="m-0 max-w-full text-[11px] sm:text-xs"
          color="success"
          style={{ border: "1px solid rgb(187 247 208)", color: "rgb(22 101 52)" }}
        >
          数据截至 {dataAsOfDisplay}
        </Tag>
      ) : null}
      <Tag
        className={[
          "m-0 inline-flex w-max min-w-0 max-w-full min-h-6 items-center justify-center gap-1.5 px-2 text-[11px] font-medium sm:min-w-[13rem] sm:text-sm",
          isTrading
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-amber-500 bg-amber-500 text-white",
          isTrading && marketIsRefetching ? "ring-2 ring-white/30" : "",
          isTrading && justUpdated && !marketIsRefetching ? "ring-2 ring-amber-100 shadow-md" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isTrading && marketIsRefetching ? (
          <Space size={4}>
            <LoadingOutlined className="text-[13px]" />
            <span>交易中 同步中</span>
          </Space>
        ) : isTrading && justUpdated ? (
          "已更新 约 10s 刷新"
        ) : isTrading ? (
          "交易中 约 10s 刷新"
        ) : (
          "非连续竞价时段 展示最近快照"
        )}
      </Tag>
    </Space>
  );

  const marketStatsRow = hasRows ? (
    <div
      className="flex w-max max-w-none flex-nowrap items-center gap-x-2.5 rounded-md border border-slate-100 bg-slate-50/90 px-2.5 py-1.5 text-[11px] leading-none text-slate-600 ring-1 ring-slate-900/[0.04] sm:gap-x-3"
    >
      <span className="shrink-0 whitespace-nowrap">
        成分 <strong className="tabular-nums text-slate-900">{summary.count}</strong> 只
      </span>
      <span className="shrink-0 whitespace-nowrap">
        自由流通市值（约）{" "}
        <strong className="tabular-nums text-slate-900">
          {fmtNum(totalCircMvToTrillionYuan(summary.totalCircMvWan), 2)}
        </strong>{" "}
        万亿
      </span>
      <span className="shrink-0 whitespace-nowrap">
        成交额（约）{" "}
        <strong className="tabular-nums text-slate-900">
          {fmtNum(totalAmountToYiYuan(summary.totalAmountQian), 2)}
        </strong>{" "}
        亿
      </span>
      <span className="shrink-0 whitespace-nowrap">
        等权 <strong className="tabular-nums text-slate-900">{fmtPct(summary.avgPct)}</strong>
      </span>
      <span className="inline-flex shrink-0 flex-nowrap items-center gap-x-2 sm:gap-x-2.5">
        <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap">
          涨{" "}
          <strong className="tabular-nums text-red-600 leading-none">{summary.riseCount}</strong>
          <span className="text-slate-400">/</span>
          跌{" "}
          <strong className="tabular-nums text-emerald-700 leading-none">{summary.fallCount}</strong>
          <span className="text-slate-400">/</span>
          平{" "}
          <strong className="tabular-nums text-slate-800 leading-none">{summary.flatCount}</strong>
        </span>
        <Popover
          content={statsChartsPopover}
          trigger={["hover", "click"]}
          placement="bottomRight"
          mouseEnterDelay={0.12}
          getPopupContainer={() => document.body}
          styles={{
            body: {
              padding: 0,
              maxWidth: "min(calc(100vw - 16px), 1100px)",
              width: "min(calc(100vw - 16px), 1000px)",
            },
          }}
        >
          <button
            type="button"
            className="min-h-10 shrink-0 cursor-pointer touch-manipulation border-0 bg-transparent p-0 text-left text-[10px] font-medium whitespace-nowrap text-[#1e293b] underline decoration-dotted underline-offset-2 sm:min-h-0 sm:text-[11px] hover:text-slate-900 active:opacity-80"
          >
            涨跌统计
          </button>
        </Popover>
      </span>
    </div>
  ) : null;

  const marketStatsRowMobile = hasRows ? (
    <div className="flex flex-col gap-2 text-[10px] leading-relaxed text-slate-600">
      <div className="m-0 flex flex-col gap-1.5 rounded-md border border-slate-100 bg-slate-50/90 px-2 py-2 ring-1 ring-slate-900/[0.04]">
        <div>成分 {summary.count} 只</div>
        <div>
          市值约{" "}
          <strong className="tabular-nums text-slate-900">
            {fmtNum(totalCircMvToTrillionYuan(summary.totalCircMvWan), 2)}
          </strong>{" "}
          万亿
        </div>
        <div>
          成交额约{" "}
          <strong className="tabular-nums text-slate-900">
            {fmtNum(totalAmountToYiYuan(summary.totalAmountQian), 2)}
          </strong>{" "}
          亿
        </div>
        <div className="border-t border-slate-200/70 pt-1.5">
          等权 {fmtPct(summary.avgPct)}，涨{summary.riseCount}/跌{summary.fallCount}/平
          {summary.flatCount}
        </div>
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <h3 className="m-0 text-sm font-semibold text-slate-900">涨跌统计</h3>
        </div>
        <div className="px-2 pb-3 pt-2 sm:px-3">{statsChartsBlock}</div>
      </div>
    </div>
  ) : null;

  const legendBlock = (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:gap-2.5"
      aria-label="涨跌图例：色块内为涨跌幅分档（%）"
    >
      <div className="inline-flex h-5 shrink-0 items-center rounded-md bg-[#1e293b] px-1.5 text-[10px] font-medium leading-none text-white shadow-sm ring-1 ring-slate-900/20">
        当日涨跌幅
      </div>
      <div className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
        {LEGEND_BUCKETS.map((b) => (
          <span
            key={b.key}
            className="inline-flex min-h-5 shrink-0 items-center justify-center rounded-sm border border-slate-900/25 px-1 py-0.5 text-center text-[8px] font-semibold leading-tight text-white shadow-sm [text-shadow:0_0_2px_rgb(0_0_0/0.75),0_1px_2px_rgb(0_0_0/0.55)] sm:px-1.5 sm:text-[10px]"
            style={{ background: b.color }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* 移动端：悬浮顶栏 + 全屏可滚动叠在云图上方 */}
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-40 sm:hidden"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="pointer-events-auto box-border flex h-[var(--app-mobile-header-bar-h)] items-center justify-between gap-2 border-b border-slate-200/50 bg-slate-900/45 px-3 shadow-sm backdrop-blur-md">
          <span className="min-w-0 truncate text-sm font-semibold text-white drop-shadow-sm">
            A 股指数云图
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="text"
              size="small"
              className="!text-white/95 hover:!bg-white/10 hover:!text-white"
              onClick={() => setUsageHelpOpen(true)}
              aria-label="使用说明"
            >
              使用说明
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<MenuOutlined />}
              onClick={() => setMobileSheetOpen(true)}
              aria-expanded={mobileSheetOpen}
              aria-label="打开数据与设置"
            >
              数据与设置
            </Button>
          </div>
        </div>
      </div>

      {mobileSheetOpen ? (
        <div
          className="fixed inset-0 z-50 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="市场数据与设置"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-slate-950/50 p-0"
            onClick={closeMobile}
            aria-label="关闭"
          />
          <div
            className="absolute left-0 right-0 top-0 max-h-[min(92dvh,100%)] flex flex-col overflow-hidden rounded-b-2xl bg-white shadow-2xl"
            style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2.5 pr-1">
              <h2 className="m-0 text-base font-semibold text-slate-900">数据与设置</h2>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={closeMobile}
                aria-label="收起"
                className="!flex items-center"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-2">
              <p className="mb-3 rounded border border-amber-200/80 bg-amber-50/95 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-950">
                <strong>免责</strong> {MOBILE_DISCLAIMER}
              </p>
              {controlCluster({ mobile: true })}
              <div className="mt-3 space-y-3">
                {tagsAndStatusRow}
                {marketStatsRowMobile}
                {legendBlock}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <header className="hidden shrink-0 border-b border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:block sm:px-4 sm:py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-3">
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="m-0 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              A 股指数云图
            </h1>
            <Button type="link" size="small" className="!p-0" onClick={() => setUsageHelpOpen(true)}>
              使用说明
            </Button>
          </div>
          {controlCluster({ mobile: false })}
        </div>

        <div className="mt-2.5 flex flex-col gap-2">
          {tagsAndStatusRow}
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
            {hasRows ? (
              <div className="flex shrink-0 items-center">{marketStatsRow}</div>
            ) : null}
            <div className="flex min-w-0 flex-1 items-center justify-start sm:justify-end">
              {legendBlock}
            </div>
          </div>
        </div>
      </header>

      <UsageHelpModal open={usageHelpOpen} onClose={() => setUsageHelpOpen(false)} />
    </>
  );
}
