"""Tushare 客户端、重试与限流/权限错误判断（与具体同步任务解耦）。"""

from __future__ import annotations

import logging
import time

import tushare as ts

from app.config import settings

log = logging.getLogger(__name__)


def tushare_pro():
    return ts.pro_api(settings.tushare_token, timeout=60)


def retry_df(callable_fn, retries: int = 3, delay: float = 1.5):
    last = None
    for attempt in range(retries):
        try:
            return callable_fn()
        except Exception as e:
            last = e
            log.warning("tushare attempt %s failed: %s", attempt + 1, e)
            if is_tushare_rate_limit_error(e):
                # 频控后短重试只会继续撞墙；等约一整分钟再试（与 index_member_all 策略一致）
                time.sleep(65)
            else:
                time.sleep(delay * (attempt + 1))
    if last:
        raise last


def is_tushare_permission_error(exc: BaseException) -> bool:
    """积分/权限不足时 Tushare 返回文案，见 https://tushare.pro/document/1?doc_id=108"""
    msg = str(exc)
    return "没有接口访问权限" in msg or "积分不足" in msg


def is_tushare_rate_limit_error(exc: BaseException) -> bool:
    msg = str(exc)
    return (
        "每分钟最多访问" in msg
        or "每小时最多访问" in msg
        or "最多访问该接口" in msg
        or "频率超限" in msg
        or "次/分钟" in msg
        or "次/小时" in msg
    )


def index_member_all_fetch_one(pro, ts_code: str):
    """
    doc 335 单只查询；遇「每分钟最多访问」须等待整分钟后再试，勿用 retry_df 秒级连打。
    """
    for _ in range(6):
        try:
            return pro.index_member_all(ts_code=ts_code, is_new="Y")
        except Exception as e:
            if is_tushare_permission_error(e):
                raise
            if is_tushare_rate_limit_error(e):
                log.warning(
                    "index_member_all(doc 335) 限流：%s，等待 65s 后重试（"
                    "https://tushare.pro/document/1?doc_id=108）",
                    e,
                )
                time.sleep(65)
                continue
            raise
    return None
