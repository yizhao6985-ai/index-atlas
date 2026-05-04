-- Tushare trade_cal(doc 26)：SSE 交易日历缓存，供盘中任务判断是否自然日开市。
CREATE TABLE IF NOT EXISTS trade_calendar (
  exchange       VARCHAR(8) NOT NULL,
  cal_date       DATE NOT NULL,
  is_open        SMALLINT NOT NULL,
  pretrade_date  DATE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (exchange, cal_date)
);

CREATE INDEX IF NOT EXISTS idx_trade_calendar_exchange_date
  ON trade_calendar (exchange, cal_date DESC);
