/**
 * 一次性注册所有 components 与 paths，并构造生成器。仅应由 document / 类型模块引用。
 */
import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registerErrorBodySchema } from "./schemas/error.js";
import { registerHealthOkSchema } from "./schemas/health.js";
import { registerIndicesComponentSchemas } from "./schemas/indices.js";
import { registerMarketComponentSchemas } from "./schemas/market.js";
import { registerHealthPath } from "./paths/health.js";
import { registerIndicesCatalogPath } from "./paths/indices.js";
import { registerTradingSessionPath } from "./paths/session.js";
import { registerMarketSnapshotRtPath } from "./paths/market-rt.js";
import { registerTradingSessionResponseSchema } from "./schemas/session.js";
import { registry } from "./registry.js";
import { z } from "./zod.js";

const ErrorBodySchema = registerErrorBodySchema(registry);
const { IndicesResponseSchema } = registerIndicesComponentSchemas(registry);
const { MarketSnapshotResponseSchema } = registerMarketComponentSchemas(registry);
const HealthOkSchema = registerHealthOkSchema(registry);
const TradingSessionResponseSchema = registerTradingSessionResponseSchema(registry);

registerHealthPath(registry, HealthOkSchema);
registerTradingSessionPath(registry, { TradingSessionResponseSchema, ErrorBodySchema });
registerIndicesCatalogPath(registry, { IndicesResponseSchema, ErrorBodySchema });
registerMarketSnapshotRtPath(registry, { MarketSnapshotResponseSchema, ErrorBodySchema });

export const openApiGenerator = new OpenApiGeneratorV3(registry.definitions);

export const openApi = {
  ErrorBodySchema,
  IndicesResponseSchema,
  MarketSnapshotResponseSchema,
  HealthOkSchema,
} as const;

/**
 * 与 `GET /api/indices/catalog` 的 JSON 体一致。字段见 `IndicesResponse` 与 `openApi.IndicesResponseSchema`。
 */
export type IndicesResponse = z.infer<typeof IndicesResponseSchema>;
/**
 * 与 `GET /api/indices/{code}/market/rt` 的 JSON 体一致。字段见 `MarketSnapshotResponse` 与 `ConstituentQuoteRow`。
 */
export type MarketSnapshotResponse = z.infer<typeof MarketSnapshotResponseSchema>;
