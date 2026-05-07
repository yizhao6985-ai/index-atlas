import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { z } from "../zod.js";

export function registerTradingSessionResponseSchema(registry: OpenAPIRegistry) {
  return registry.register(
    "TradingSessionResponse",
    z
      .object({
        continuousAuction: z.boolean().openapi({
          description:
            "当前是否处在连续竞价：SSE `trade_calendar` 当日开市 + 上海墙钟 09:30–11:30、13:00–15:00（整分口径与 worker/rt_k 一致）。",
        }),
        msUntilCurrentAuctionEnd: z.number().int().nullable().openapi({
          description:
            "仅在 continuousAuction=true 时有值：距本轮连续竞价结束（午休或 15:00 后一整分）还有多少毫秒；否则 null。",
        }),
        msUntilNextAuctionStart: z.number().int().nullable().openapi({
          description:
            "仅在 continuousAuction=false 时有意义：距下一段连续竞价开始还有多少毫秒（盘前/午休/盘后/非交易日）；盘中为 null。",
        }),
        nextSessionBoundaryAt: z.string().openapi({
          format: "date-time",
          description:
            "下一「连续竞价状态可能变化」的绝对时刻（UTC ISO8601）。客户端应在此前后再次调用本接口以便切换对 market/rt 的轮询。",
          example: "2026-05-06T03:31:00.000Z",
        }),
      })
      .openapi({ description: "GET /api/session 成功响应体" }),
  );
}
