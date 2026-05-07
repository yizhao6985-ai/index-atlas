import type { OpenAPIObject } from "openapi3-ts/oas30";
import { openApiGenerator } from "./setup.js";

const INFO_DESCRIPTION = [
  "BFF for A-share index constituents + quotes（成分股 + 行情）。",
  "历史日线在 `quotes_daily`，实时 `rt_k` 在 `quotes_rt`。",
  "`/api/indices/{code}/market/rt` 返回原始行；热力图聚合由前端按 `metric` 计算，可选 `sortBy`（与 `metric` 同枚举）对 `rows` 排序。",
  "JSON 字段为 camelCase；业务类型由 `src/openapi/` 下 Zod `z.infer` 与 schema 同源。",
  "交互式文档：`/api/docs`；规范下载：`/api/openapi.json`。",
  "本规范由 `src/openapi/` 内 Zod + `@asteasolutions/zod-to-openapi` 生成。",
].join("\n");

let cached: OpenAPIObject | null = null;

export function getOpenApiDocument(): OpenAPIObject {
  if (!cached) {
    cached = openApiGenerator.generateDocument({
      openapi: "3.0.3",
      info: {
        title: "Index Atlas API",
        version: "1.0.0",
        description: INFO_DESCRIPTION,
      },
      servers: [
        { url: "/", description: "相对当前主机（本地直连 API 或经 Nginx 反代）" },
        { url: "http://localhost:3001", description: "本地开发直连 Node" },
      ],
      tags: [
        { name: "Meta", description: "运维" },
        { name: "Session", description: "交易时段（连续竞价判定，供前端刷新节奏）" },
        { name: "Indices", description: "指数" },
        { name: "Market", description: "大盘成分与行情快照" },
      ],
    });
  }
  return cached;
}
