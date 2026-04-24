"""同步任务共用：日期/数值解析、成分代码集合、股本与涨跌幅计算等。"""

from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Any

from chinese_calendar import is_workday
from psycopg.rows import dict_row

from app.db import connect, exec_sql
from app.trading import today_trade_date


def parse_tushare_date(v: Any) -> datetime.date:
    if v is None:
        raise ValueError("missing trade_date")
    if isinstance(v, datetime.date) and not isinstance(v, datetime.datetime):
        return v
    s = str(v).replace("-", "").strip()
    if len(s) >= 8 and s[:8].isdigit():
        return datetime.datetime.strptime(s[:8], "%Y%m%d").date()
    return datetime.date.fromisoformat(str(v)[:10])


def str_or_none(v: Any) -> str | None:
    if v is None or (isinstance(v, float) and v != v):
        return None
    s = str(v).strip()
    return s or None


def to_dec(v: Any) -> Decimal | None:
    if v is None or (isinstance(v, float) and v != v):
        return None
    try:
        return Decimal(str(v))
    except Exception:
        return None


def calc_pct(pre_close: Decimal | None, close: Decimal | None) -> Decimal | None:
    if pre_close is None or close is None:
        return None
    if pre_close == 0:
        return None
    return (close - pre_close) / pre_close * Decimal(100)


def calc_circ_mv(float_share_wan: Decimal | None, close: Decimal | None) -> Decimal | None:
    """流通市值（元）= float_share(万股) × 10000 × close(元/股)；与 Tushare daily_basic 的 circ_mv(万元) 不是同一口径。"""
    if float_share_wan is None or close is None:
        return None
    return float_share_wan * Decimal(10000) * close


def chunks(seq: list[str], n: int) -> list[list[str]]:
    return [seq[i : i + n] for i in range(0, len(seq), n)]


def recent_workday_candidates(anchor: datetime.date, max_workdays: int = 8) -> list[datetime.date]:
    """从 anchor 起向前取若干工作日（daily_basic 日终更新，盘中可能尚无当日数据）。"""
    out: list[datetime.date] = []
    d = anchor
    while len(out) < max_workdays and (anchor - d).days <= 20:
        if is_workday(d):
            out.append(d)
        d -= datetime.timedelta(days=1)
    return out


def ensure_stock_stub(conn, ts_code: str, name: str | None = None) -> None:
    exec_sql(
        conn,
        """
        INSERT INTO stocks (ts_code, name)
        VALUES (%s, %s)
        ON CONFLICT (ts_code) DO NOTHING
        """,
        (ts_code, name or ts_code),
    )


def fetch_constituent_union_codes() -> list[str]:
    """各指数最新成分并集（与 rt_k / daily 一致）。"""
    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                WITH latest AS (
                  SELECT index_id, MAX(trade_date) AS td
                  FROM index_constituents
                  GROUP BY index_id
                )
                SELECT DISTINCT ic.con_code AS con_code
                FROM index_constituents ic
                JOIN latest l ON l.index_id = ic.index_id AND l.td = ic.trade_date
                """
            )
            return [str(r["con_code"]) for r in cur.fetchall()]


def constituent_codes_missing_sw() -> list[str]:
    """各指数最新成分中，尚未写入 sw_l1_code 的代码（申万已在库则返回空列表）。"""
    codes = fetch_constituent_union_codes()
    if not codes:
        return []
    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT s.ts_code, s.sw_l1_code
                FROM stocks s
                WHERE s.ts_code = ANY(%s)
                """,
                (codes,),
            )
            have = {str(r["ts_code"]): r["sw_l1_code"] for r in cur.fetchall()}
    out: list[str] = []
    for c in codes:
        v = have.get(c)
        if v is None or (isinstance(v, str) and not str(v).strip()):
            out.append(c)
    return sorted(set(out))


def quotes_workday_candidates(for_date: datetime.date | None) -> list[datetime.date]:
    """daily / daily_basic 用的交易日候选。"""
    anchor = for_date or today_trade_date()
    if for_date is not None:
        return [for_date]
    return recent_workday_candidates(anchor)


def last_n_workdays_newest_first(
    anchor: datetime.date,
    n: int,
    max_lookback_calendar_days: int = 180,
) -> list[datetime.date]:
    """从 anchor 起向前数 n 个工作日，顺序为 [较新, …, 较旧]（anchor 侧优先）。"""
    out: list[datetime.date] = []
    d = anchor
    while len(out) < n and (anchor - d).days <= max_lookback_calendar_days:
        if is_workday(d):
            out.append(d)
        d -= datetime.timedelta(days=1)
    return out
