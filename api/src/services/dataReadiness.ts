/**
 * 启动时数据门闸：无成分或无行情时立即退出，引导先跑 worker 灌库。
 */
import type pg from "pg";

import { DATA_READINESS_SQL } from "../sql/readiness.js";

/**
 * 开发/CI 若需跳过（例如只跑接口单测、库刻意为空）可设 `BFF_SKIP_DATA_CHECK=1`。
 */
export async function assertTreemapDataReady(pool: pg.Pool): Promise<void> {
  if (process.env.BFF_SKIP_DATA_CHECK === "1") {
    console.warn("[api] BFF_SKIP_DATA_CHECK=1：跳过库内数据检查");
    return;
  }
  const r = await pool.query(DATA_READINESS_SQL);
  const row = r.rows[0] as
    | { constituents: string | number; quotes: string | number }
    | undefined;
  const c = Number(row?.constituents ?? 0);
  const q = Number(row?.quotes ?? 0);
  if (c >= 1 && q >= 1) {
    console.log(
      `[api] data readiness ok: index_constituents=${c} quotes_daily+quotes_rt=${q}`,
    );
    return;
  }
  console.error(
    `[api] 缺少 market 依赖数据（index_constituents=${c}, quotes_daily+quotes_rt=${q}）。请先灌库：cd worker && uv run python scripts/bootstrap_local_data.py`,
  );
  process.exit(1);
}
