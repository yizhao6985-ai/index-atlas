import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { z } from "zod";

export function registerTradingSessionPath(
  registry: OpenAPIRegistry,
  schemas: { TradingSessionResponseSchema: z.ZodType; ErrorBodySchema: z.ZodType },
): void {
  const { TradingSessionResponseSchema, ErrorBodySchema } = schemas;

  registry.registerPath({
    method: "get",
    path: "/api/session",
    operationId: "getTradingSession",
    summary: "连续竞价会话（用于前端「交易中」与刷新节奏）",
    tags: ["Meta"],
    responses: {
      200: {
        description: "当前会话形态",
        content: { "application/json": { schema: TradingSessionResponseSchema } },
      },
      500: {
        description: "查询失败",
        content: { "application/json": { schema: ErrorBodySchema } },
      },
    },
  });
}
