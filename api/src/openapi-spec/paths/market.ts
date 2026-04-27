import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { z } from "zod";
import { z as zod } from "../zod.js";

export function registerMarketSnapshotPath(
  registry: OpenAPIRegistry,
  schemas: {
    MarketSnapshotResponseSchema: z.ZodType;
    ErrorBodySchema: z.ZodType;
  },
): void {
  const { MarketSnapshotResponseSchema, ErrorBodySchema } = schemas;
  registry.registerPath({
    method: "get",
    path: "/api/indices/{code}/market",
    operationId: "getMarketSnapshot",
    summary: "指定指数大盘成分行情快照（原始行）",
    description:
      "不传 `tradeDate` 时从预计算表 `market_constituent_rollups` 读 `window`（1d/7d/30d 交易日，由灌库/晚盘根据 quotes_daily 重算）。`1d` 为最近一交易日与当前成分；`7d`/`30d` 为窗内首尾收盘涨跌与成交额合。`1d` 且预计算无行时回退为 live（quotes_rt 优先、否则 quotes_daily 当日）。传 `tradeDate=YYYY-MM-DD` 时忽略 `window`，仅查该日 `quotes_daily` 且成分取最新批。",
    tags: ["Market"],
    request: {
      params: zod.object({
        // 路径中的指数代码
        code: zod
          .string()
          .openapi({ description: "指数代码（路径参数，如 000985.SH）", example: "000985.SH" }),
      }),
      query: zod.object({
        // 可选：指定只查某日日线
        tradeDate: zod
          .string()
          .optional()
          .openapi({
            description:
              "若指定：仅该日期的 quotes_daily 快照，且忽略 `window`；不指定时读预计算行 + `window`",
            example: "2025-04-18",
          }),
        window: zod
          .enum(["1d", "7d", "30d"])
          .optional()
          .openapi({
            description:
              "与 `tradeDate` 二选一：未传 `tradeDate` 时生效。预计算时间窗：1/7/30 个交易日。默认 1d",
            example: "7d",
          }),
      }),
    },
    responses: {
      200: {
        description: "成功返回该指数下成分与行情行",
        content: { "application/json": { schema: MarketSnapshotResponseSchema } },
      },
      400: {
        description: "tradeDate 或 window 参数非法",
        content: { "application/json": { schema: ErrorBodySchema } },
      },
      404: {
        description: "未知指数代码",
        content: { "application/json": { schema: ErrorBodySchema } },
      },
      500: {
        description: "数据库错误",
        content: { "application/json": { schema: ErrorBodySchema } },
      },
    },
  });
}
