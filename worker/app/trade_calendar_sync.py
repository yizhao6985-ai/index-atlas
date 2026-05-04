"""Tushare 交易日历 trade_cal(doc 26)：启动与 evening 同步；盘内按自然日缓存是否开市，避免 10s 轮询打库。"""

from __future__ import annotations

import datetime
import logging
import threading

import pandas as pd
from chinese_calendar import is_workday
from psycopg.rows import dict_row
from zoneinfo import ZoneInfo

from app.db import connect, exec_sql
from app.trading import today_trade_date
from app.tushare_client import (
    is_tushare_permission_error,
    retry_df,
    tushare_pro,
)

log = logging.getLogger(__name__)

CN_TZ = ZoneInfo("Asia/Shanghai")
SSE = "SSE"

# (上海自然日, 是否 SSE 开市)：同一天内 10s 轮询只查库一次
_cache_lock = threading.Lock()
_trading_day_cache: tuple[datetime.date, bool] | None = None


def invalidate_trading_day_cache() -> None:
    """trade_cal 写库后调用，使下一轮重新读库。"""
    global _trading_day_cache
    with _cache_lock:
        _trading_day_cache = None


def today_sse_is_trading_day(now: datetime.datetime | None = None) -> bool:
    """本自然日是否 A 股开市（SSE trade_cal is_open=1）。无库记录时退回 chinese_calendar 工作日。
    同一自然日内结果内存缓存，减少 10s 轮询下的数据库访问。"""
    if now is None:
        d = today_trade_date()
    else:
        d = now.astimezone(CN_TZ).date()

    with _cache_lock:
        if _trading_day_cache is not None and _trading_day_cache[0] == d:
            return _trading_day_cache[1]

    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT is_open FROM trade_calendar
                WHERE exchange = %s AND cal_date = %s
                """,
                (SSE, d),
            )
            row = cur.fetchone()
    if row is None:
        val = is_workday(d)
    else:
        val = int(row["is_open"]) == 1

    with _cache_lock:
        _trading_day_cache = (d, val)
    return val


def sync_trade_cal_month_window() -> None:
    """
    拉取 [今天, 今天+约31天] 的 SSE trade_cal(doc 26) 并 upsert。
    由 **启动时**、**16:15 evening** 调用；完成后清空当日开市缓存以便重新读库。
    """
    today = today_trade_date()
    end = today + datetime.timedelta(days=31)
    start_s = _fmt_yyyymmdd(today)
    end_s = _fmt_yyyymmdd(end)
    pro = tushare_pro()
    try:
        df = retry_df(
            lambda: pro.trade_cal(exchange=SSE, start_date=start_s, end_date=end_s),
            retries=3,
            delay=1.5,
        )
    except Exception as e:
        if is_tushare_permission_error(e):
            log.warning("trade_cal(doc 26) skipped: 无接口权限或积分不足")
            return
        raise

    if df is None or df.empty:
        log.warning("trade_cal(doc 26): empty response for %s..%s", start_s, end_s)
        return

    rows: list[tuple] = []
    for _, r in df.iterrows():
        cal_d = _parse_cal_date(r.get("cal_date"))
        if cal_d is None:
            continue
        try:
            is_open = int(str(r.get("is_open", "0")).strip() or "0")
        except ValueError:
            is_open = 0
        pre = _parse_cal_date(r.get("pretrade_date"))
        exch = str(r.get("exchange") or SSE).strip() or SSE
        rows.append((exch, cal_d, is_open, pre))

    if not rows:
        log.warning("trade_cal(doc 26): no parseable rows")
        return

    with connect() as conn:
        for exch, cal_d, is_open, pre in rows:
            exec_sql(
                conn,
                """
                INSERT INTO trade_calendar (exchange, cal_date, is_open, pretrade_date, updated_at)
                VALUES (%s, %s, %s, %s, now())
                ON CONFLICT (exchange, cal_date) DO UPDATE SET
                  is_open = EXCLUDED.is_open,
                  pretrade_date = EXCLUDED.pretrade_date,
                  updated_at = now()
                """,
                (exch, cal_d, is_open, pre),
            )

    invalidate_trading_day_cache()
    log.info(
        "trade_cal(doc 26): upserted %s rows for %s..%s (exchange=%s)",
        len(rows),
        start_s,
        end_s,
        rows[0][0],
    )


def _fmt_yyyymmdd(d: datetime.date) -> str:
    return d.strftime("%Y%m%d")


def _parse_cal_date(v: object) -> datetime.date | None:
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    if len(s) == 8 and s.isdigit():
        return datetime.date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    try:
        return datetime.date.fromisoformat(s[:10])
    except ValueError:
        return None
