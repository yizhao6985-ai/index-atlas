/**
 * 指数目录：读 `indices` 表，与 OpenAPI `getIndicesCatalog` 及生成类型一致。
 */
import type pg from "pg";

import type { IndicesResponse } from "../openapi.js";
import { DEFAULT_CODE } from "../config.js";

/** 返回可选指数列表与前端默认 code（见 `config.DEFAULT_CODE`） */
export async function fetchIndicesList(
  pool: pg.Pool,
): Promise<IndicesResponse> {
  const r = await pool.query(
    `SELECT code, name, sort_order AS "sortOrder", tushare_index_code AS "tushareIndexCode"
     FROM indices ORDER BY sort_order`,
  );
  return {
    defaultCode: DEFAULT_CODE,
    indices: r.rows.map((row) => ({
      code: row.code,
      name: row.name,
      sortOrder: row.sortOrder,
      tushareIndexCode: row.tushareIndexCode ?? null,
    })),
  };
}
