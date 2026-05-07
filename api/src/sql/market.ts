/** 从 stocks 带出的申万列（与 Left Join stocks 配合） */
const SHENWAN_IN_SELECT = `
  s.sw_l1_code AS "swL1Code",
  s.sw_l1_name AS "swL1Name",
  s.sw_l2_code AS "swL2Code",
  s.sw_l2_name AS "swL2Name",
  s.sw_l3_code AS "swL3Code",
  s.sw_l3_name AS "swL3Name"
`;

/** 当前指数最新一批成分是否在 quotes_rt 中至少有一条（决定是否走 rt 合并）。 */
export const MARKET_SQL_QUOTES_RT_EXISTS_FOR_INDEX = `
SELECT EXISTS (
  SELECT 1
  FROM quotes_rt q
  INNER JOIN index_constituents ic ON ic.con_code = q.stock_code
  INNER JOIN indices i ON i.id = ic.index_id AND i.code = $1
  INNER JOIN (
    SELECT MAX(ic2.trade_date) AS td
    FROM index_constituents ic2
    INNER JOIN indices i2 ON i2.id = ic2.index_id AND i2.code = $1
  ) mx ON ic.trade_date = mx.td
  LIMIT 1
) AS has_rt
`;

const LIVE_BASE_CTES = `
WITH idx AS (
  SELECT id, code FROM indices WHERE code = $1
),
const_date AS (
  SELECT MAX(ic.trade_date) AS td
  FROM index_constituents ic
  JOIN idx ON ic.index_id = idx.id
),
const_rows AS (
  SELECT ic.con_code, ic.weight
  FROM index_constituents ic
  JOIN idx ON ic.index_id = idx.id
  JOIN const_date cd ON ic.trade_date = cd.td
),
q_rt AS (
  SELECT DISTINCT ON (q.stock_code)
    q.stock_code,
    q.trade_date,
    q.snapshot_at,
    q.circ_mv,
    q.amount,
    q.pct_change
  FROM quotes_rt q
  INNER JOIN const_rows cr ON cr.con_code = q.stock_code
  ORDER BY q.stock_code, q.trade_date DESC, q.snapshot_at DESC
),
q_d AS (
  SELECT DISTINCT ON (qd.stock_code)
    qd.stock_code,
    qd.trade_date,
    qd.snapshot_at,
    qd.circ_mv,
    qd.amount,
    qd.pct_change
  FROM quotes_daily qd
  INNER JOIN const_rows cr ON cr.con_code = qd.stock_code
  ORDER BY qd.stock_code, qd.trade_date DESC, qd.snapshot_at DESC
)
`;

/**
 * 当前指数这组成分里至少一只在 quotes_rt 有快照时启用：每只成分若有 rt 则仅用 rt，否则退回 quotes_daily。
 */
export const MARKET_SQL_RT_MERGE = `
${LIVE_BASE_CTES}
SELECT
  c.con_code AS "tsCode",
  COALESCE(NULLIF(TRIM(s.name), ''), c.con_code) AS "name",
  CASE WHEN rt.stock_code IS NOT NULL THEN rt.circ_mv ELSE qd.circ_mv END AS "circMv",
  CASE WHEN rt.stock_code IS NOT NULL THEN rt.amount ELSE qd.amount END AS "amount",
  CASE WHEN rt.stock_code IS NOT NULL THEN rt.pct_change ELSE qd.pct_change END AS "pctChange",
  CASE WHEN rt.stock_code IS NOT NULL THEN rt.snapshot_at ELSE qd.snapshot_at END AS "snapshotAt",
  CASE WHEN rt.stock_code IS NOT NULL THEN rt.trade_date ELSE qd.trade_date END AS "tradeDate",
  c.weight AS "weight",
  ${SHENWAN_IN_SELECT}
FROM const_rows c
LEFT JOIN stocks s ON s.ts_code = c.con_code
LEFT JOIN q_rt rt ON rt.stock_code = c.con_code
LEFT JOIN q_d qd ON qd.stock_code = c.con_code
WHERE rt.stock_code IS NOT NULL OR qd.stock_code IS NOT NULL
`;

/**
 * `quotes_rt` 已清空（如晚盘 TRUNCATE 后）：仅使用每只成分 quotes_daily **最新交易日**一行，即当日收盘落库结果。
 */
export const MARKET_SQL_DAILY_FALLBACK = `
${LIVE_BASE_CTES}
SELECT
  c.con_code AS "tsCode",
  COALESCE(NULLIF(TRIM(s.name), ''), c.con_code) AS "name",
  qd.circ_mv AS "circMv",
  qd.amount AS "amount",
  qd.pct_change AS "pctChange",
  qd.snapshot_at AS "snapshotAt",
  qd.trade_date AS "tradeDate",
  c.weight AS "weight",
  ${SHENWAN_IN_SELECT}
FROM const_rows c
LEFT JOIN stocks s ON s.ts_code = c.con_code
INNER JOIN q_d qd ON qd.stock_code = c.con_code
`;

/** 主查询无行时打日志用：该指数下成分数、全库行情行数、成分/日线的最大日期 */
export const MARKET_EMPTY_DIAG_SQL = `SELECT
   (SELECT COUNT(*)::int FROM index_constituents ic
      JOIN indices i ON i.id = ic.index_id WHERE i.code = $1) AS constituents,
   (SELECT COUNT(*)::int FROM quotes_daily)
     + (SELECT COUNT(*)::int FROM quotes_rt) AS quotes,
   (SELECT MAX(ic.trade_date)::text FROM index_constituents ic
      JOIN indices i ON i.id = ic.index_id WHERE i.code = $1) AS const_max_td,
   (SELECT MAX(trade_date)::text FROM quotes_daily) AS quote_max_td`;
