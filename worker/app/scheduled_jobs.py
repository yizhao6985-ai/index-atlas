"""APScheduler 调用的同步任务入口（与进程启动、调度表解耦）。"""

from __future__ import annotations

import logging

from app.trading import is_trading_session
from app.trade_calendar_sync import (
    sync_trade_cal_month_window,
    today_sse_is_trading_day,
)
from app.shenwan_industry_sync import sync_shenwan_industries_full
from app.market_rollups import sync_market_constituent_rollups
from app.tushare_sync import (
    clear_quotes_rt,
    sync_index_weight,
    sync_quotes_daily_latest_and_prune,
    sync_rt_k_snapshot,
    sync_share_float_daily_basic,
)

log = logging.getLogger(__name__)


def job_rt_k() -> None:
    """由 main 中轮询线程调用；仅读库 trade_calendar 判断本日是否开市，不在此请求 trade_cal。
    仅在连续竞价时段且 SSE 日历 is_open 时请求 rt_k（日历由 16:15 evening 同步 doc 26）。"""
    if not is_trading_session():
        return
    if not today_sse_is_trading_day():
        return
    log.info("rt_k：交易时段且本日为 SSE 交易日，拉取 rt_k(doc 372) → quotes_rt")
    try:
        sync_rt_k_snapshot()
    except Exception:
        log.exception("rt_k job failed")


def job_evening() -> None:
    """工作日 16:15：拉取未来约一月 SSE 交易日历；指数权重、流通股本、申万、daily→quotes_daily，最后清空 quotes_rt。"""
    try:
        sync_trade_cal_month_window()
    except Exception:
        log.exception("evening sync: trade_cal(doc 26) failed")
    try:
        sync_index_weight()
    except Exception:
        log.exception("evening sync: index_weight failed")
    try:
        sync_shenwan_industries_full()
    except Exception:
        log.exception("evening sync: shenwan industry failed")
    try:
        sync_share_float_daily_basic()
    except Exception:
        log.exception("evening sync: daily_basic float_share failed")
    try:
        sync_quotes_daily_latest_and_prune()
    except Exception:
        log.exception("evening sync: daily → quotes_daily failed")
    try:
        sync_market_constituent_rollups()
    except Exception:
        log.exception("evening sync: market rollups (1d/7d/30d) failed")
    try:
        clear_quotes_rt()
    except Exception:
        log.exception("evening sync: clear quotes_rt failed")
