/**
 * 运行时配置：从仓库根目录 `.env` 加载环境变量并导出常用常量。
 * 其它模块应通过本文件读取配置，避免散落 `process.env`。
 */
import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(apiRoot, "..");
loadEnv({ path: join(repoRoot, ".env") });

/** HTTP 监听端口，默认 3001（与前端 dev proxy / docker 约定一致时可改） */
export const PORT = Number(process.env.PORT ?? 3001);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
/** PostgreSQL 连接串；BFF 仅只读查询 */
export { DATABASE_URL };

/** 前端热力图默认选中的指数代码（与 `indices` 表及 OpenAPI 示例一致） */
export const DEFAULT_CODE = "000985.SH";

/** `/api/indices/:code/market/rt` 进程内缓存存活时间（毫秒），可用 `BFF_CACHE_TTL_MS` 覆盖 */
export const BFF_CACHE_TTL_MS = Number(process.env.BFF_CACHE_TTL_MS ?? 4000);
