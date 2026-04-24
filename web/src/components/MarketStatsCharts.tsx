import { BarChart, PieChart } from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";

import { useEcharts } from "@/hooks/useEcharts";
import type { MarketSummary } from "@/lib/marketStats";

use([
  BarChart,
  PieChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type DistRow = { label: string; color: string; count: number };

type Layout = "fill" | "block" | "popover" | "mobile";

export default function MarketStatsCharts({
  summary,
  distRows,
  layout = "block",
}: {
  summary: MarketSummary;
  distRows: DistRow[];
  /** popover：顶栏悬停层里固定宽高；mobile：移动抽屉内纵向双图 */
  layout?: Layout;
}) {
  const fill = layout === "fill";
  const popover = layout === "popover";
  const mobile = layout === "mobile";

  const barOption = useMemo(() => {
    const rows = distRows;
    const wide = popover;
    return {
      tooltip: {
        trigger: "item" as const,
        formatter: (params: unknown) => {
          const p = params as { name?: string; value?: number };
          return `${p.name ?? ""}<br/>家数：${p.value ?? 0}`;
        },
      },
      grid: {
        left: wide ? 8 : mobile ? 2 : 6,
        right: wide ? 8 : mobile ? 2 : 4,
        top: wide ? 18 : 20,
        bottom: mobile ? 4 : 2,
        containLabel: true,
      },
      xAxis: {
        type: "category" as const,
        data: rows.map((r) => r.label),
        axisLabel: {
          fontSize: wide ? 9 : 9,
          color: "#64748b",
          rotate: wide ? 20 : mobile ? 30 : 24,
          interval: 0,
          margin: wide ? 10 : mobile ? 10 : 8,
        },
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
      },
      yAxis: {
        type: "value" as const,
        minInterval: 1,
        splitLine: { lineStyle: { type: "dashed" as const, color: "#e2e8f0" } },
        axisLabel: { fontSize: 10, color: "#64748b" },
      },
      series: [
        {
          type: "bar" as const,
          data: rows.map((r) => ({
            value: r.count,
            name: r.label,
            itemStyle: {
              color: r.color,
              borderRadius: [3, 3, 0, 0],
            },
          })),
          barMaxWidth: wide ? 40 : mobile ? 36 : 32,
          label: {
            show: true,
            position: "top" as const,
            fontSize: 10,
            color: "#475569",
          },
        },
      ],
    };
  }, [distRows, popover, mobile]);

  const pieOption = useMemo(() => {
    const s = summary;
    const data = [
      { value: s.riseCount, name: "上涨 (>0.9%)", itemStyle: { color: "#ef4444" } },
      { value: s.fallCount, name: "下跌 (<−0.9%)", itemStyle: { color: "#059669" } },
      { value: s.flatCount, name: "平盘 / 微幅", itemStyle: { color: "#94a3b8" } },
      { value: s.naPctCount, name: "无涨跌幅", itemStyle: { color: "#cbd5e1" } },
    ].filter((d) => d.value > 0);

    if (data.length === 0) {
      return {
        graphic: {
          type: "text" as const,
          left: "center",
          top: "middle",
          style: {
            text: "暂无分类数据",
            fill: "#94a3b8",
            fontSize: 14,
          },
        },
        series: [],
      };
    }

    const baseSeries = {
      type: "pie" as const,
      avoidLabelOverlap: true,
      itemStyle: { borderColor: "#fff", borderWidth: 1 },
      label: {
        formatter: "{b}\n{c} 只",
        fontSize: popover ? 9 : mobile ? 10 : 9,
        lineHeight: popover ? 15 : mobile ? 16 : 14,
      },
      emphasis: {
        scale: true,
        scaleSize: 4,
      },
      data,
    };

    // 全部使用 plain 图例，避免 scroll 图例的「翻页」交互；不同布局用位置区分
    if (popover) {
      return {
        tooltip: {
          trigger: "item" as const,
          formatter: "{b}<br/>{c} 只 ({d}%)",
        },
        legend: {
          type: "plain" as const,
          left: "center",
          bottom: 4,
          itemWidth: 9,
          itemHeight: 9,
          itemGap: 10,
          textStyle: { fontSize: 9, color: "#64748b" },
        },
        series: [
          {
            ...baseSeries,
            radius: ["34%", "62%"] as [string, string],
            center: ["50%", "46%"] as [string, string],
          },
        ],
      };
    }

    if (mobile) {
      return {
        tooltip: {
          trigger: "item" as const,
          formatter: "{b}<br/>{c} 只 ({d}%)",
        },
        legend: {
          type: "plain" as const,
          orient: "vertical" as const,
          right: 4,
          top: "center",
          itemWidth: 8,
          itemHeight: 8,
          itemGap: 8,
          textStyle: { fontSize: 10, color: "#64748b" },
        },
        series: [
          {
            ...baseSeries,
            radius: ["28%", "54%"] as [string, string],
            center: ["44%", "50%"] as [string, string],
          },
        ],
      };
    }

    // block / fill：双栏并排，饼图用右侧纵向图例，一次展示全部
    return {
      tooltip: {
        trigger: "item" as const,
        formatter: "{b}<br/>{c} 只 ({d}%)",
      },
      legend: {
        type: "plain" as const,
        orient: "vertical" as const,
        right: 0,
        top: "center",
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 6,
        textStyle: { fontSize: 9, color: "#64748b" },
      },
      series: [
        {
          ...baseSeries,
          radius: ["32%", "58%"] as [string, string],
          center: ["40%", "50%"] as [string, string],
        },
      ],
    };
  }, [summary, popover, mobile]);

  const barRef = useEcharts(barOption);
  const pieRef = useEcharts(pieOption);

  const chartRowClass = popover
    ? "grid w-full min-h-0 min-w-0 flex-1 [grid-template-columns:minmax(0,1.65fr)_minmax(0,1fr)] items-stretch gap-4"
    : mobile
      ? "flex w-full min-w-0 flex-col gap-5"
      : "grid w-full min-h-0 min-w-0 flex-1 [grid-template-columns:minmax(0,1.5fr)_minmax(0,1fr)] items-stretch gap-3 sm:gap-4";
  const colClass = "flex min-h-0 min-w-0 max-w-full flex-col";

  const chartBoxClass = fill
    ? "flex min-h-[200px] h-full w-full min-w-0 flex-1 flex-col"
    : popover
      ? "flex h-[min(256px,40vh)] min-h-[220px] w-full min-w-0 flex-1 flex-col sm:min-h-[234px]"
      : mobile
        ? "flex h-[min(240px,40svh)] w-full min-h-[200px] min-w-0 flex-col"
        : "flex h-[clamp(240px,38vh,480px)] w-full min-h-[220px] min-w-0 flex-1 flex-col";

  const titleClass = popover
    ? "mb-1.5 shrink-0 text-[12px] font-semibold text-slate-800"
    : mobile
      ? "mb-1.5 shrink-0 text-[13px] font-semibold text-slate-800"
      : "mb-2 shrink-0 text-[13px] font-semibold text-slate-800";
  const echartMinH = popover ? "min-h-[170px]" : mobile ? "min-h-[180px]" : "min-h-[200px]";

  return (
    <div
      className={
        fill
          ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
          : popover
            ? "flex h-[min(330px,48vh)] min-h-[300px] w-full min-w-0 max-w-full flex-col"
            : "w-full min-w-0"
      }
    >
      <div
        className={`${chartRowClass} ${fill || popover ? "min-h-0 flex-1" : mobile ? "min-w-0" : ""}`}
      >
        <div className={colClass}>
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
            <h3 className={titleClass}>涨跌幅档位分布</h3>
            <div className={chartBoxClass}>
              <div ref={barRef} className={`h-full w-full min-w-0 flex-1 ${echartMinH}`} />
            </div>
          </div>
        </div>
        <div className={colClass}>
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
            <h3 className={titleClass}>涨跌家数概览</h3>
            <div
              className={
                mobile
                  ? "flex h-[min(260px,42svh)] w-full min-h-[200px] min-w-0 flex-col"
                  : chartBoxClass
              }
            >
              <div ref={pieRef} className={`h-full w-full min-w-0 flex-1 ${echartMinH}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
