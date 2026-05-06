import { TreemapChart as TreemapSeries } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";

import { colorForPctChange } from "@/lib/colors";
import type { TreemapNode } from "@/lib/treemapBuilder";
import { totalAmountToYiYuan } from "@/lib/marketStats";
import { xueqiuStockUrl } from "@/lib/xueqiu";
import { useEcharts } from "@/hooks/useEcharts";

/** 自由流通市值：库内 `circ_mv` 为**元**（非万元）→ 亿元 */
function fmtCircMvYi(yuan: number | null | undefined): string {
  if (yuan == null || Number.isNaN(Number(yuan)) || Number(yuan) <= 0) return "—";
  return `${(Number(yuan) / 1e8).toFixed(2)} 亿`;
}

/** 成交额（千元）→ 亿元 */
function fmtAmountYi(qian: number | null | undefined): string {
  if (qian == null || Number.isNaN(Number(qian)) || Number(qian) <= 0) return "—";
  return `${totalAmountToYiYuan(Number(qian)).toFixed(2)} 亿`;
}

/** 成分权重：与 `index_constituents.weight` / Tushare 一致，为占指数的百分点数值，直接加 % 展示，勿再 ×100 */
function fmtConstituentWeight(w: number | null | undefined): string {
  if (w == null || Number.isNaN(Number(w))) return "—";
  const x = Number(w);
  if (x === 0) return "0%";
  return `${x.toFixed(4)}%`;
}

use([TreemapSeries, TooltipComponent, CanvasRenderer]);

function decorate(node: TreemapNode): Record<string, unknown> {
  const fill = colorForPctChange(node.pctChange ?? undefined);
  const base: Record<string, unknown> = {
    name: node.name,
    value: node.value,
    itemStyle: { color: fill },
    pct: node.pctChange,
  };
  if (node.children?.length) {
    return { ...base, children: node.children.map(decorate) };
  }
  const xq = xueqiuStockUrl(node.tsCode);
  return {
    ...base,
    label: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: 600,
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowBlur: 2,
      textShadowOffsetX: 0,
      textShadowOffsetY: 1,
    },
    tsCode: node.tsCode,
    circMv: node.circMv,
    amount: node.amount,
    weight: node.weight,
    ...(xq ? { link: xq, target: "blank" as const } : {}),
  };
}

export default function TreemapChart({ root }: { root: TreemapNode }) {
  const option = useMemo(
    () => ({
      tooltip: {
        formatter: (raw: unknown) => {
          const info = raw as {
            name?: string;
            treePathInfo?: { name: string; dataIndex?: number }[];
            data?: {
              pct?: number | null;
              tsCode?: string;
              value?: number;
              circMv?: number | null;
              amount?: number | null;
              weight?: number | null;
            };
          };
          const name = info.name ?? "";
          const data = info.data;
          const parts = info.treePathInfo
            ?.map((n) => n.name)
            .filter((n) => n && n !== "root") ?? [name];
          const isLeaf = Boolean(data?.tsCode);
          const swPath = isLeaf && parts.length > 0 ? parts.slice(0, -1).join(" / ") : parts.join(" / ");
          const pct = data?.pct;
          const pctStr =
            pct == null || Number.isNaN(Number(pct)) ? "—" : `${Number(pct).toFixed(2)}%`;
          if (isLeaf) {
            const code = data?.tsCode ? `${data.tsCode} · ` : "";
            const circ = fmtCircMvYi(data?.circMv);
            const turnover = fmtAmountYi(data?.amount);
            const w = fmtConstituentWeight(data?.weight);
            const xq = data?.tsCode ? xueqiuStockUrl(data.tsCode) : null;
            return [
              `${code}<b>${name}</b>`,
              `申万: ${swPath || "—"}`,
              `涨跌幅: ${pctStr}`,
              `自由流通市值: ${circ}`,
              `成交额: ${turnover}`,
              `成分权重: ${w}`,
              ...(xq
                ? [
                    `<span style="opacity:.85;font-size:11px">点击方块跳转雪球</span>`,
                  ]
                : []),
            ].join("<br/>");
          }
          return `<b>${name}</b><br/>申万路径: ${swPath || name}<br/>加权涨跌幅: ${pctStr}<br/><span style="opacity:.85;font-size:12px">（块面积为下属子项加总，配色按加权限跌幅分档）</span>`;
        },
      },
      series: [
        {
          type: "treemap",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          roam: false,
          // 叶子节点 data 上带 `link` 时跳转雪球；无 link 的父级点击无动作
          nodeClick: "link",
          breadcrumb: { show: false },
          // 有子级：顶栏行业名 — 与页面标题区一致，深底白字
          upperLabel: {
            show: true,
            height: 20,
            color: "#ffffff",
            backgroundColor: "#1e293b",
            fontSize: 11,
            fontWeight: 600,
            textBorderWidth: 0,
            formatter: "{b}",
            overflow: "truncate",
            padding: [2, 6, 2, 6],
          },
          label: {
            show: true,
            formatter: "{b}",
            position: "inside",
            fontSize: 10,
            fontWeight: 600,
            color: "#ffffff",
            textShadowColor: "rgba(0,0,0,0.45)",
            textShadowBlur: 2,
            textShadowOffsetY: 1,
            overflow: "truncate",
            minMargin: 2,
            padding: 2,
          },
          itemStyle: { borderColor: "#0f172a", borderWidth: 1, gapWidth: 1 },
          levels: [
            {
              itemStyle: { borderColor: "#0f172a", borderWidth: 1, gapWidth: 2 },
              label: { show: false },
              upperLabel: {
                fontSize: 11,
                height: 20,
                fontWeight: 600,
                color: "#ffffff",
                backgroundColor: "#1e293b",
              },
            },
            {
              itemStyle: { gapWidth: 1 },
              label: { show: false },
              upperLabel: {
                fontSize: 10,
                height: 19,
                fontWeight: 600,
                color: "#ffffff",
                backgroundColor: "#1e293b",
              },
            },
            {
              itemStyle: { gapWidth: 1 },
              label: { show: false },
              upperLabel: {
                fontSize: 10,
                height: 18,
                fontWeight: 600,
                color: "#ffffff",
                backgroundColor: "#1e293b",
              },
            },
            {
              // 股票：具体颜色由 data.label 覆盖
              itemStyle: { borderWidth: 1, gapWidth: 0 },
              upperLabel: { show: false },
              label: { show: true, fontSize: 10, lineHeight: 13, minMargin: 2, fontWeight: 600 },
            },
          ],
          data: root.children?.map(decorate) ?? [],
        },
      ],
    }),
    [root],
  );

  const ref = useEcharts(option);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col touch-pan-y">
      <div
        ref={ref}
        className="h-full min-h-[min(280px,58dvh)] w-full min-w-0 flex-1 sm:min-h-[240px]"
      />
    </div>
  );
}
