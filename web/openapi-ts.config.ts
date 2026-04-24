import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@hey-api/openapi-ts";

const webRoot = dirname(fileURLToPath(import.meta.url));

const raw = process.env.OPENAPI_INPUT?.trim();
const defaultInput = "http://127.0.0.1:3001/api/openapi.json";
const input =
  !raw
    ? defaultInput
    : raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : resolve(webRoot, raw);

/**
 * 生成物在 `src/api/generated/`（`types.gen.ts`、`sdk.gen.ts`、`client.gen.ts` 等）。
 * 业务代码在组件或其它模块中直接 import 生成的方法，例如：
 *   import { listIndices, getMarketSnapshotRt } from "@/api/generated/sdk.gen";
 * 勿再包一层 `lib/api` 封装。`main.tsx` 里需先 `configureHeyApiClient()`。
 */
export default defineConfig({
  input,
  output: "src/api/generated",
  plugins: ["@hey-api/client-fetch"],
});
