import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { z } from "../zod.js";

export function registerTradingSessionResponseSchema(registry: OpenAPIRegistry) {
  return registry.register(
    "TradingSessionResponse",
    z
      .object({
        continuousAuction: z.boolean().openapi({
          description:
            "是否处于连续竞价刷新窗口：SSE 日历当日开市 + 09:30–11:30、13:00–15:00（上海墙钟）。与盘中 rt_k 条件对齐。",
        }),
        sseOpenDay: z
          .boolean()
          .openapi({ description: "SSE `trade_calendar.is_open=1`，无行时退回为非周末近似" }),
        tradeCalendarHit: z.boolean().openapi({
          description: "是否在库内命中 `trade_calendar` 当日行（未命中时退回规则较粗）",
        }),
        shanghaiDate: z.string().openapi({
          description: "判断所使用的上海自然日 YYYY-MM-DD",
        }),
      })
      .openapi({ description: "GET /api/session 成功响应体" }),
  );
}
