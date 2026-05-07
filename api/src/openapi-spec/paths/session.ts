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
    summary: "连续竞价状态与下一轮询锚点（驱动 market/rt 轮询节律）",
    tags: ["Session"],
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
