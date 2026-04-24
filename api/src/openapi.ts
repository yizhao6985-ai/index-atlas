/**
 * OpenAPI 3.0.3 对外入口：`getOpenApiDocument` 与 BFF/前端共用的业务类型。
 * 契约定义拆在 `openapi-spec/`（Zod + `@asteasolutions/zod-to-openapi`）。
 */
export { getOpenApiDocument } from "./openapi-spec/document.js";
export type { IndicesResponse, MarketSnapshotResponse } from "./openapi-spec/setup.js";
