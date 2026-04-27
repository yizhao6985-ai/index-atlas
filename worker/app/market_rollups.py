"""
预计算 market 时间窗（1d / 7d / 30d 交易日）成分行，写入 market_constituent_rollups。

由晚盘与灌库在 quotes_daily 更新后执行；BFF 只读本表。/market/rt 在盘中有 quotes_rt 用 rt，清库后用 quotes_daily。
"""

from __future__ import annotations

import logging

log = logging.getLogger(__name__)

TRUNC = "TRUNCATE market_constituent_rollups RESTART IDENTITY"

INSERT_1D = """
INSERT INTO market_constituent_rollups (
  index_id, window_code, as_of_trade_date, con_code,
  circ_mv, amount, pct_change, weight, trade_date, snapshot_at
)
WITH
as_d AS (SELECT MAX(trade_date)::date AS d FROM quotes_daily),
cd AS (
  SELECT MAX(ic.trade_date) AS td
  FROM index_constituents ic
  WHERE ic.index_id = %s
),
cr AS (
  SELECT ic.con_code, ic.weight
  FROM index_constituents ic, cd
  WHERE ic.index_id = %s AND ic.trade_date = cd.td
)
SELECT
  %s,
  '1d',
  (SELECT d FROM as_d),
  cr.con_code,
  q.circ_mv,
  q.amount,
  q.pct_change,
  cr.weight,
  q.trade_date::date,
  q.snapshot_at
FROM cr
INNER JOIN quotes_daily q
  ON q.stock_code = cr.con_code
 AND q.trade_date = (SELECT d FROM as_d)
"""

def _insert_nd_template(in_placeholders: str) -> str:
    return f"""
INSERT INTO market_constituent_rollups (
  index_id, window_code, as_of_trade_date, con_code,
  circ_mv, amount, pct_change, weight, trade_date, snapshot_at
)
WITH
cd AS (
  SELECT MAX(ic.trade_date) AS td
  FROM index_constituents ic
  WHERE ic.index_id = %s
),
cr AS (
  SELECT ic.con_code, ic.weight
  FROM index_constituents ic, cd
  WHERE ic.index_id = %s AND ic.trade_date = cd.td
),
qe AS (
  SELECT stock_code, circ_mv, close, trade_date, snapshot_at, amount
  FROM quotes_daily
  WHERE trade_date = %s::date
),
qs AS (
  SELECT stock_code, close
  FROM quotes_daily
  WHERE trade_date = %s::date
),
sa AS (
  SELECT stock_code, SUM(amount) AS sum_amt
  FROM quotes_daily
  WHERE trade_date IN ({in_placeholders})
  GROUP BY stock_code
)
SELECT
  %s,
  %s,
  %s::date,
  cr.con_code,
  qe.circ_mv,
  sa.sum_amt,
  CASE
    WHEN qs.close IS NULL OR qe.close IS NULL THEN NULL
    WHEN qs.close = 0 THEN NULL
    ELSE ((qe.close::numeric / qs.close::numeric) - 1) * 100
  END,
  cr.weight,
  qe.trade_date::date,
  qe.snapshot_at
FROM cr
INNER JOIN qe ON qe.stock_code = cr.con_code
LEFT JOIN qs ON qs.stock_code = cr.con_code
LEFT JOIN sa ON sa.stock_code = cr.con_code
"""


def _last_n_trade_dates(
    cur, as_of: datetime.date, n: int
) -> list[datetime.date]:
    cur.execute(
        """
        SELECT DISTINCT trade_date::date AS d
        FROM quotes_daily
        WHERE trade_date <= %(as_of)s
        ORDER BY trade_date DESC
        LIMIT %(n)s
        """,
        {"as_of": as_of, "n": n},
    )
    return [r["d"] for r in cur.fetchall()]


def sync_market_constituent_rollups() -> None:
    """以 quotes_daily 为全部指数写 1d/7d/30d 三窗（TRUNC 后全量重写）。"""
    from app.db import connect

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT MAX(trade_date)::date AS d FROM quotes_daily")
            row = cur.fetchone()
            as_of = row["d"] if row and row.get("d") is not None else None
            if as_of is None:
                log.warning("market rollups: quotes_daily 为空，跳过")
                return

            cur.execute("SELECT id FROM indices ORDER BY sort_order, id")
            index_ids = [r["id"] for r in cur.fetchall()]

            cur.execute(TRUNC)
            n_ins = 0
            for iid in index_ids:
                cur.execute(INSERT_1D, (iid, iid, iid))
                n_ins += cur.rowcount or 0
                for n, label in ((7, "7d"), (30, "30d")):
                    dates = _last_n_trade_dates(cur, as_of, n)
                    if not dates:
                        continue
                    d_start = min(dates)
                    d_end = max(dates)
                    ph = ", ".join(["%s"] * len(dates))
                    sql = _insert_nd_template(ph)
                    # params: iid, iid, d_end, d_start, *dates, iid, label, d_end
                    cur.execute(
                        sql,
                        (
                            iid,
                            iid,
                            d_end,
                            d_start,
                            *dates,
                            iid,
                            label,
                            d_end,
                        ),
                    )
                    n_ins += cur.rowcount or 0
    log.info("market rollups: 重算完成，约写入 %s 行", n_ins)
