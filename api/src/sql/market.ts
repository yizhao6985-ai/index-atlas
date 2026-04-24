/** 从 stocks 带出的申万列（与 Left Join stocks 配合） */
const SHENWAN_IN_SELECT = `
  s.sw_l1_code AS "swL1Code",
  s.sw_l1_name AS "swL1Name",
  s.sw_l2_code AS "swL2Code",
  s.sw_l2_name AS "swL2Name",
  s.sw_l3_code AS "swL3Code",
  s.sw_l3_name AS "swL3Name"
`;

/** 仅 quotes_rt，无 quotes_daily 回退（用于盘中实时专用接口） */
export const MARKET_SQL_RT_ONLY = `
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
  SELECT DISTINCT ON (stock_code)
    stock_code,
    trade_date,
    snapshot_at,
    circ_mv,
    amount,
    pct_change
  FROM quotes_rt
  ORDER BY stock_code, trade_date DESC, snapshot_at DESC
)
SELECT
  c.con_code AS "tsCode",
  COALESCE(NULLIF(TRIM(s.name), ''), c.con_code) AS "name",
  rt.circ_mv AS "circMv",
  rt.amount AS "amount",
  rt.pct_change AS "pctChange",
  rt.snapshot_at AS "snapshotAt",
  rt.trade_date AS "tradeDate",
  c.weight AS "weight",
  ${SHENWAN_IN_SELECT}
FROM const_rows c
LEFT JOIN stocks s ON s.ts_code = c.con_code
INNER JOIN q_rt rt ON rt.stock_code = c.con_code
`;

/**
 * 时间窗预计算行（1d/7d/30d 交易日，见 market_constituent_rollups，由 worker 灌库/晚盘写）
 */
export const MARKET_ROLLUP_SQL = `
SELECT
  m.con_code AS "tsCode",
  COALESCE(NULLIF(TRIM(s.name), ''), m.con_code) AS "name",
  m.circ_mv AS "circMv",
  m.amount AS "amount",
  m.pct_change AS "pctChange",
  m.snapshot_at AS "snapshotAt",
  m.trade_date::date AS "tradeDate",
  m.weight AS "weight",
  ${SHENWAN_IN_SELECT}
FROM market_constituent_rollups m
JOIN indices i ON i.id = m.index_id
LEFT JOIN stocks s ON s.ts_code = m.con_code
WHERE i.code = $1 AND m.window_code = $2
`;

/** 最新成分；行情优先 quotes_rt（rt_k），否则 quotes_daily 最新收盘 */
export const MARKET_SQL_LIVE = `
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
  SELECT DISTINCT ON (stock_code)
    stock_code,
    trade_date,
    snapshot_at,
    circ_mv,
    amount,
    pct_change
  FROM quotes_rt
  ORDER BY stock_code, trade_date DESC, snapshot_at DESC
),
q_d AS (
  SELECT DISTINCT ON (stock_code)
    stock_code,
    trade_date,
    snapshot_at,
    circ_mv,
    amount,
    pct_change
  FROM quotes_daily
  ORDER BY stock_code, trade_date DESC, snapshot_at DESC
)
SELECT
  c.con_code AS "tsCode",
  COALESCE(NULLIF(TRIM(s.name), ''), c.con_code) AS "name",
  COALESCE(rt.circ_mv, qd.circ_mv) AS "circMv",
  COALESCE(rt.amount, qd.amount) AS "amount",
  COALESCE(rt.pct_change, qd.pct_change) AS "pctChange",
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

/** 历史某日：仅 quotes_daily，成分仍为当前最新一批（与 live 一致） */
export const MARKET_SQL_HISTORICAL = `
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
qh AS (
  SELECT
    stock_code,
    trade_date,
    snapshot_at,
    circ_mv,
    amount,
    pct_change
  FROM quotes_daily
  WHERE trade_date = $2::date
)
SELECT
  c.con_code AS "tsCode",
  COALESCE(NULLIF(TRIM(s.name), ''), c.con_code) AS "name",
  q.circ_mv AS "circMv",
  q.amount AS "amount",
  q.pct_change AS "pctChange",
  q.snapshot_at AS "snapshotAt",
  q.trade_date AS "tradeDate",
  c.weight AS "weight",
  ${SHENWAN_IN_SELECT}
FROM const_rows c
LEFT JOIN stocks s ON s.ts_code = c.con_code
JOIN qh q ON q.stock_code = c.con_code
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
