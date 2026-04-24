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
    summary: "指定指数成分行情（仅实时 quotes_rt）",
    description:
      "与 `/market` 返回体结构相同，但只使用 `quotes_rt` 中最新一条，不回退 `quotes_daily`。非交易/未入库实时时行可能减少或为空。",
    tags: ["Market"],
    request: {
      params: zod.object({
        code: zod
          .string()
          .openapi({ description: "指数代码", example: "000985.SH" }),
      }),
    },
    responses: {
      200: {
        description: "成功；可能含空 rows（无 rt 数据时）",
        content: { "application/json": { schema: MarketSnapshotResponseSchema } },
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
