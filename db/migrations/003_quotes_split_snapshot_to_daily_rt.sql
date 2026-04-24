-- 将旧表 quotes_snapshot 迁出为 quotes_daily（历史日线）+ quotes_rt（实时，初始为空）。
-- 新库若已用 001_init（含 quotes_daily / quotes_rt）可安全执行：仅当存在 quotes_snapshot 时搬迁并 DROP。

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

DO $$
BEGIN
  IF to_regclass('public.quotes_snapshot') IS NOT NULL THEN
    INSERT INTO quotes_daily (
      trade_date, snapshot_at, stock_code, pre_close, close, pct_change, amount, vol, circ_mv, created_at
    )
    SELECT trade_date, snapshot_at, stock_code, pre_close, close, pct_change, amount, vol, circ_mv, created_at
    FROM quotes_snapshot
    ON CONFLICT (trade_date, stock_code) DO UPDATE SET
      snapshot_at = EXCLUDED.snapshot_at,
      pre_close = EXCLUDED.pre_close,
      close = EXCLUDED.close,
      pct_change = EXCLUDED.pct_change,
      amount = EXCLUDED.amount,
      vol = EXCLUDED.vol,
      circ_mv = EXCLUDED.circ_mv,
      created_at = EXCLUDED.created_at;
    DROP TABLE quotes_snapshot CASCADE;
  END IF;
END $$;
