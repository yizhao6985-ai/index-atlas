-- share_premarket：股本口径由 Tushare daily_basic.float_share（流通股本）
-- 调整为 free_share（自由流通股本，万股）。已有库重命名列；新库若已由 001 建为 free_share 则跳过。
-- 注意：仅重命名不改正历史数值；请重新执行 daily_basic→share_premarket 同步以写入 free_share 口径。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'share_premarket'
      AND column_name = 'float_share'
  ) THEN
    ALTER TABLE share_premarket RENAME COLUMN float_share TO free_share;
  END IF;
END $$;
