"""APScheduler 调用的同步任务入口（与进程启动、调度表解耦）。"""

from __future__ import annotations

import logging

from app.trading import is_trading_session
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
    """由 main 中轮询线程调用；线程按「轮开始 → 轮开始」间隔补足 sleep。仅交易时段内才请求 Tushare（见 trading.is_trading_session）。"""
    if not is_trading_session():
        return
    log.info("rt_k：当前为交易时段，拉取 rt_k(doc 372) → quotes_rt")
    try:
        sync_rt_k_snapshot()
    except Exception:
        log.exception("rt_k job failed")


def job_evening() -> None:
    """工作日 16:15：指数权重、流通股本、申万、daily→quotes_daily（更新当日并保留约 30 交易日），最后清空 quotes_rt。"""
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
