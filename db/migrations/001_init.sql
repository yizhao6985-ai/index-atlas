-- A-share index treemap — initial schema (plan §6)

CREATE TABLE IF NOT EXISTS indices (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(32) NOT NULL UNIQUE,
  name            VARCHAR(128) NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  tushare_index_code VARCHAR(32),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stocks (
  ts_code         VARCHAR(16) PRIMARY KEY,
  name            VARCHAR(128) NOT NULL,
  sw_l1_code      VARCHAR(32),
  sw_l1_name      VARCHAR(128),
  sw_l2_code      VARCHAR(32),
  sw_l2_name      VARCHAR(128),
  sw_l3_code      VARCHAR(32),
  sw_l3_name      VARCHAR(128),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS index_constituents (
  id              BIGSERIAL PRIMARY KEY,
  index_id        INT NOT NULL REFERENCES indices (id) ON DELETE CASCADE,
  con_code        VARCHAR(16) NOT NULL,
  trade_date      DATE NOT NULL,
  weight          NUMERIC(18, 8),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (index_id, con_code, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_index_constituents_index_date
  ON index_constituents (index_id, trade_date DESC);

-- 流通股本 float_share（万股）：由 worker 经 Tushare daily_basic(doc 32) 写入
CREATE TABLE IF NOT EXISTS share_premarket (
  id              BIGSERIAL PRIMARY KEY,
  trade_date      DATE NOT NULL,
  ts_code         VARCHAR(16) NOT NULL REFERENCES stocks (ts_code) ON DELETE CASCADE,
  float_share     NUMERIC(24, 4) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_date, ts_code)
);

CREATE INDEX IF NOT EXISTS idx_share_premarket_ts_date
  ON share_premarket (ts_code, trade_date DESC);

-- 历史日线 daily(doc 27)，按 trade_date 保留多窗；前端选历史日期时只读此表
CREATE TABLE IF NOT EXISTS quotes_daily (
  id              BIGSERIAL PRIMARY KEY,
  trade_date      DATE NOT NULL,
  snapshot_at     TIMESTAMPTZ NOT NULL,
  stock_code      VARCHAR(16) NOT NULL,
  pre_close       NUMERIC(18, 6),
  close           NUMERIC(18, 6),
  pct_change      NUMERIC(12, 6),
  amount          NUMERIC(24, 4),
  vol             NUMERIC(24, 4),
  circ_mv         NUMERIC(24, 4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_date, stock_code)
);

CREATE INDEX IF NOT EXISTS idx_quotes_daily_trade_snapshot
  ON quotes_daily (trade_date, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_daily_stock_trade
  ON quotes_daily (stock_code, trade_date DESC);

-- 实时行情 rt_k(doc 372)；默认大盘快照优先此表，无则回退 quotes_daily 最新收盘
CREATE TABLE IF NOT EXISTS quotes_rt (
  id              BIGSERIAL PRIMARY KEY,
  trade_date      DATE NOT NULL,
  snapshot_at     TIMESTAMPTZ NOT NULL,
  stock_code      VARCHAR(16) NOT NULL,
  pre_close       NUMERIC(18, 6),
  close           NUMERIC(18, 6),
  pct_change      NUMERIC(12, 6),
  amount          NUMERIC(24, 4),
  vol             NUMERIC(24, 4),
  circ_mv         NUMERIC(24, 4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_date, stock_code)
);

CREATE INDEX IF NOT EXISTS idx_quotes_rt_trade_snapshot
  ON quotes_rt (trade_date, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_rt_stock_trade
  ON quotes_rt (stock_code, trade_date DESC);

-- Seed seven indices (plan §3)
INSERT INTO indices (code, name, sort_order, tushare_index_code) VALUES
  ('000001.SH', '上证指数', 1, '000001.SH'),
  ('399001.SZ', '深证成指', 2, '399001.SZ'),
  ('000300.SH', '沪深300', 3, '000300.SH'),
  ('000905.SH', '中证500', 4, '000905.SH'),
  ('000852.SH', '中证1000', 5, '000852.SH'),
  ('399006.SZ', '创业板指', 6, '399006.SZ'),
  ('000688.SH', '科创50', 7, '000688.SH')
ON CONFLICT (code) DO NOTHING;
