import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../zod.js";

export function registerErrorBodySchema(registry: OpenAPIRegistry) {
  return registry.register(
    "ErrorBody",
    z
      .object({
        // 机器可读错误码或标识
        error: z
          .string()
          .openapi({ description: "机器可读的错误标识（如 not_found、invalid_trade_date）", example: "not_found" }),
      })
      .openapi({ description: "业务错误时返回的 JSON 体" }),
  );
}
