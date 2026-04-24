import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../zod.js";

export function registerMarketComponentSchemas(registry: OpenAPIRegistry) {
  const ConstituentQuoteRowSchema = registry.register(
    "ConstituentQuoteRow",
    z
      .object({
        // 股票 Tushare 代码
        tsCode: z.string().openapi({ description: "股票代码（Tushare 形式，如 600000.SH）" }),
        // 证券简称
        name: z.string().openapi({ description: "证券简称" }),
        // 流通市值（万元）
        circMv: z.union([z.number(), z.null()]).openapi({
          description:
            "流通市值（元）：库内为 float_share(万股)×10000×close，与 `quotes_daily`/`quotes_rt` 的 circ_mv 列一致，非 Tushare daily_basic 的万元口径",
        }),
        // 成交额（千元）
        amount: z.union([z.number(), z.null()]).openapi({
          description:
            "成交额（千元）：Tushare daily 为千元；`quotes_rt` 由 rt_k 的元/1000 与日线对齐，与库内 amount 一致",
        }),
        // 涨跌幅（%）
        pctChange: z.union([z.number(), z.null()]).openapi({ description: "涨跌幅（%）" }),
        // 行情快照时间
        snapshotAt: z
          .union([z.string(), z.null()])
          .openapi({ description: "该条行情记录的快照时间；无时为 null" }),
        // 该条对应的交易日
        tradeDate: z
          .union([z.string(), z.null()])
          .openapi({ description: "该条快照对应的交易日（YYYY-MM-DD）；无时为 null" }),
        // 指数成分内权重
        weight: z.union([z.number(), z.null()]).openapi({
          description:
            "指数成分权重（index_constituents.weight，与 Tushare index_weight 一致，多为占指数百分比）",
        }),
        // 申万行业（stocks 表，无申万时全为 null，前端可组 L1→L2→L3→股 treemap）
        swL1Code: z
          .union([z.string(), z.null()])
          .openapi({ description: "申万一级行业代码" }),
        swL1Name: z
          .union([z.string(), z.null()])
          .openapi({ description: "申万一级行业名称" }),
        swL2Code: z
          .union([z.string(), z.null()])
          .openapi({ description: "申万二级行业代码" }),
        swL2Name: z
          .union([z.string(), z.null()])
          .openapi({ description: "申万二级行业名称" }),
        swL3Code: z
          .union([z.string(), z.null()])
          .openapi({ description: "申万三级行业代码" }),
        swL3Name: z
          .union([z.string(), z.null()])
          .openapi({ description: "申万三级行业名称" }),
      })
      .openapi({ description: "单只成分股在指数下的一行行情" }),
  );

  const MarketSnapshotResponseSchema = registry.register(
    "MarketSnapshotResponse",
    z
      .object({
        // 指数代码
        indexCode: z.string().openapi({ description: "请求的指数代码" }),
        // 全部成分中最新快照时间
        dataAsOf: z
          .union([z.string(), z.null()])
          .openapi({ description: "全部成分中 snapshot_at 的最大值（数据新鲜度）；无时为 null" }),
        // 本批行情对应的交易日
        tradeDate: z
          .union([z.string(), z.null()])
          .openapi({ description: "本响应行情数据对应的交易日（结果集内各成分最大行情日；无时为 null）" }),
        // 成分行列表
        rows: z
          .array(ConstituentQuoteRowSchema)
          .openapi({ description: "该指数下成分股行情行（原始行，热力图由前端再聚合）" }),
      })
      .openapi({ description: "GET /api/indices/{code}/market 成功响应体" }),
  );

  return { ConstituentQuoteRowSchema, MarketSnapshotResponseSchema };
}
