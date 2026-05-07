import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { z } from "zod";

export function registerIndicesCatalogPath(
  registry: OpenAPIRegistry,
  schemas: {
    IndicesResponseSchema: z.ZodType;
    ErrorBodySchema: z.ZodType;
  },
): void {
  const { IndicesResponseSchema, ErrorBodySchema } = schemas;
  registry.registerPath({
    method: "get",
    path: "/api/indices/catalog",
    operationId: "getIndicesCatalog",
    summary: "可选指数目录（供前端列表/切换）",
    tags: ["Indices"],
    responses: {
      200: {
        description: "成功返回指数列表与默认指数代码",
        content: { "application/json": { schema: IndicesResponseSchema } },
      },
      500: {
        description: "数据库错误",
        content: { "application/json": { schema: ErrorBodySchema } },
      },
    },
  });
}
