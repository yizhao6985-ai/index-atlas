import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { z } from "zod";

export function registerHealthPath(
  registry: OpenAPIRegistry,
  HealthOkSchema: z.ZodType,
): void {
  registry.registerPath({
    method: "get",
    path: "/health",
    operationId: "health",
    summary: "健康检查",
    tags: ["Meta"],
    responses: {
      200: {
        description: "服务正常，返回 ok: true",
        content: { "application/json": { schema: HealthOkSchema } },
      },
    },
  });
}
