"""与 scripts/bootstrap_local_data.py 全量灌库一致的四步（供 worker 启动自动灌库复用）。"""

from __future__ import annotations

import logging

from app.config import settings
from app.shenwan_industry_sync import sync_shenwan_industries_full
from app.market_rollups import sync_market_constituent_rollups
from app.tushare_sync import (
    sync_index_weight,
    sync_quotes_daily_bootstrap_window,
    sync_share_float_daily_basic,
)

_log = logging.getLogger(__name__)


def run_full_bootstrap(log: logging.Logger | None = None) -> None:
    """最新指数成分 → 最新申万 → 最新自由流通股本 → quotes_daily 约 N 个交易日 → 时间窗预计算行。"""
    lg = log or _log
    lg.info("灌库 1/5 index_weight（指数最新成分与权重）")
    sync_index_weight()
    lg.info("灌库 2/5 申万行业（最新分类与成分）→ stocks.sw_*")
    sync_shenwan_industries_full()
    lg.info("灌库 3/5 daily_basic → share_premarket（最新自由流通股本 free_share）")
    sync_share_float_daily_basic()
    lg.info(
        "灌库 4/5 daily(doc 27) 回填约 %s 个交易日 → quotes_daily，"
        "并保留最近 %s 个交易日（更早整日删除；全市场见 QUOTES_DAILY_FULL_MARKET）",
        settings.quotes_daily_bootstrap_trade_days,
        settings.quotes_daily_retention_trade_days,
    )
    sync_quotes_daily_bootstrap_window()
    lg.info("灌库 5/5 预计算时间窗行 → market_constituent_rollups（1d/7d/30d）")
    try:
        sync_market_constituent_rollups()
    except Exception:
        lg.exception("灌库：market rollups 失败（可晚盘重算）")
    lg.info("灌库流程结束")
