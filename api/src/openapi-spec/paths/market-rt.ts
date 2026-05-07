import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { z } from "zod";
import { z as zod } from "../zod.js";

/** `GET …/market/rt` OpenAPI 注册 */
export function registerMarketSnapshotRtPath(
  registry: OpenAPIRegistry,
  schemas: { MarketSnapshotResponseSchema: z.ZodType; ErrorBodySchema: z.ZodType },
): void {
  const { MarketSnapshotResponseSchema, ErrorBodySchema } = schemas;
  registry.registerPath({
    method: "get",
    path: "/api/indices/{code}/market/rt",
    operationId: "getMarketSnapshotRt",
    summary: "指定指数成分行情（rt 优先；无 rt 时用日线）",
    description:
      "先判断「指数当前这批成分」在 `quotes_rt` 是否至少有一条：`q_rt`/`q_d` CTE 仅聚合这批代码；若至少有 rt，则各行有 rt 用 rt、否则 `quotes_daily` 补缺；若这批成分暂无 rt（或整体清库），则仅用 `quotes_daily` 各自最新交易日。不支持「日线覆盖同期 rt」。支持 `sortBy`/`sortOrder`。",
    tags: ["Market"],
    request: {
      params: zod.object({
        code: zod
          .string()
          .openapi({ description: "指数代码", example: "000985.SH" }),
      }),
      query: zod.object({
        sortBy: zod
          .enum(["weight", "turnover", "mcap"])
          .optional()
          .openapi({
            description:
              "按面积维度对 `rows` 排序：`weight` 成分权重、`turnover` 成交额（千元）、`mcap` 自由流通市值（元）",
            example: "mcap",
          }),
        sortOrder: zod
          .enum(["asc", "desc"])
          .optional()
          .openapi({
            description: "与 `sortBy` 联用；默认 `desc`",
            example: "desc",
          }),
      }),
    },
    responses: {
      200: {
        description: "成功；可能含空 rows（无 rt 数据时）",
        content: { "application/json": { schema: MarketSnapshotResponseSchema } },
      },
      400: {
        description: "sort 相关参数非法",
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
