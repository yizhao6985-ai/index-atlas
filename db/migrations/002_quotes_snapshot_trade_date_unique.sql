-- 仅适用于仍存在表 quotes_snapshot 的旧库（在 003 拆分之前）。
-- 自旧版 UNIQUE(snapshot_at, stock_code) 迁移到 UNIQUE(trade_date, stock_code)。
-- 新库请用 001_init（quotes_daily + quotes_rt），无需执行本文件。

DELETE FROM quotes_snapshot
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY trade_date, stock_code
        ORDER BY snapshot_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM quotes_snapshot
  ) t
  WHERE rn > 1
);

ALTER TABLE quotes_snapshot
  DROP CONSTRAINT IF EXISTS quotes_snapshot_snapshot_at_stock_code_key;

ALTER TABLE quotes_snapshot
  DROP CONSTRAINT IF EXISTS quotes_snapshot_trade_date_stock_code_key;

ALTER TABLE quotes_snapshot
  ADD CONSTRAINT quotes_snapshot_trade_date_stock_code_key UNIQUE (trade_date, stock_code);
