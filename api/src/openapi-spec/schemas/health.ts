import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../zod.js";

export function registerHealthOkSchema(registry: OpenAPIRegistry) {
  return registry.register(
    "HealthOk",
    z
      .object({
        // 健康状态
        ok: z.boolean().openapi({ description: "为 true 表示进程存活", example: true }),
      })
      .openapi({ description: "GET /health 成功响应体" }),
  );
}
