-- 预计算各指数、各时间窗（1/7/30 交易日）下成分行，供 BFF 读表而非每次聚合 quotes_daily
-- 序：在 001_init、002/003 行情表结构就绪之后执行
CREATE TABLE IF NOT EXISTS market_constituent_rollups (
  id                 BIGSERIAL PRIMARY KEY,
  index_id           INT NOT NULL REFERENCES indices (id) ON DELETE CASCADE,
  window_code        VARCHAR(8) NOT NULL, -- 1d | 7d | 30d
  as_of_trade_date   DATE NOT NULL,       -- 与 quotes_daily 最新交易日对齐
  con_code           VARCHAR(16) NOT NULL,
  circ_mv            NUMERIC(24, 4),
  amount             NUMERIC(24, 4),      -- 1d=当日额；7d/30d=窗内各交易日额之和
  pct_change         NUMERIC(12, 6),      -- 1d=日涨跌幅；7d/30d=窗内首尾收盘复权近似涨跌%
  weight             NUMERIC(18, 8),
  trade_date         DATE,                -- 行情行对应日（多窗时取 as_of 当日用于 circ 等）
  snapshot_at        TIMESTAMPTZ,
  computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (index_id, window_code, con_code)
);

CREATE INDEX IF NOT EXISTS idx_mcr_index_window
  ON market_constituent_rollups (index_id, window_code);

CREATE INDEX IF NOT EXISTS idx_mcr_as_of
  ON market_constituent_rollups (as_of_trade_date DESC);
