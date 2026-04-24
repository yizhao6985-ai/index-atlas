import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "../zod.js";

export function registerIndicesComponentSchemas(registry: OpenAPIRegistry) {
  const IndexSchema = registry.register(
    "Index",
    z
      .object({
        // 指数代码（如 000985.SH）
        code: z.string().openapi({ description: "指数代码（如 000985.SH）" }),
        // 指数名称
        name: z.string().openapi({ description: "指数名称" }),
        // 展示排序
        sortOrder: z.number().int().openapi({ description: "列表展示排序，数值越小越靠前" }),
        // Tushare 侧指数代码，未配置为 null
        tushareIndexCode: z
          .union([z.string(), z.null()])
          .openapi({ description: "Tushare 侧指数代码；未配置时为 null" }),
      })
      .openapi({ description: "单条指数元数据" }),
  );

  const IndicesResponseSchema = registry.register(
    "IndicesResponse",
    z
      .object({
        // 可选的指数列表
        indices: z.array(IndexSchema).openapi({ description: "可选指数列表" }),
        // 默认选中的指数代码
        defaultCode: z
          .string()
          .openapi({ description: "前端默认选中的指数代码", example: "000985.SH" }),
      })
      .openapi({ description: "GET /api/indices 成功响应体" }),
  );

  return { IndexSchema, IndicesResponseSchema };
}
