import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { z } from "zod";
import { z as zod } from "../zod.js";

/** 仅 quotes_rt 的实时（盘中）行情，结构同 getMarketSnapshot */
export function registerMarketSnapshotRtPath(
  registry: OpenAPIRegistry,
  schemas: { MarketSnapshotResponseSchema: z.ZodType; ErrorBodySchema: z.ZodType },
): void {
  const { MarketSnapshotResponseSchema, ErrorBodySchema } = schemas;
  registry.registerPath({
    method: "get",
    path: "/api/indices/{code}/market/rt",
    operationId: "getMarketSnapshotRt",
    summary: "指定指数成分行情（实时：rt 优先，否则当日 daily）",
    description:
      "与 `/market` 的 live 一致：优先 `quotes_rt` 最新一行；晚盘清空 `quotes_rt` 后回退为 `quotes_daily` 当日收盘。返回体结构同 getMarketSnapshot。支持 `sortBy`/`sortOrder` 对 `rows` 按面积维度排序。",
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
