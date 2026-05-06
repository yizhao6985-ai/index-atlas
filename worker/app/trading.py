from __future__ import annotations

import datetime
from zoneinfo import ZoneInfo

from chinese_calendar import is_workday

CN_TZ = ZoneInfo("Asia/Shanghai")


def is_trading_session(now: datetime.datetime | None = None) -> bool:
    """
    连续竞价时段（分钟精度）：与 BFF isContinuousAuctionWallClock、web/src/lib/tradingSession 一致。
    仅当 chinese_calendar.is_workday 为真时继续判断；区间为 09:30–11:30、13:00–15:00（含两端整分钟内的全部秒）。
    若用 datetime.time 与 11:30、15:00 比较，会在 11:30:00.000001 起停拉 rt_k，而前端按「时+分」仍把
    11:30:01–11:30:59 算作盘中，导致「数据截至」停在较早快照但状态仍显示交易中。
    """
    if now is None:
        now = datetime.datetime.now(CN_TZ)
    else:
        if now.tzinfo is None:
            now = now.replace(tzinfo=CN_TZ)
        else:
            now = now.astimezone(CN_TZ)

    d = now.date()
    if not is_workday(d):
        return False

    minutes = now.hour * 60 + now.minute
    open_am = 9 * 60 + 30
    close_am = 11 * 60 + 30
    open_pm = 13 * 60
    close_pm = 15 * 60
    in_continuous = (open_am <= minutes <= close_am) or (open_pm <= minutes <= close_pm)
    return in_continuous


def today_trade_date(now: datetime.datetime | None = None) -> datetime.date:
    if now is None:
        now = datetime.datetime.now(CN_TZ)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=CN_TZ)
    else:
        now = now.astimezone(CN_TZ)
    return now.date()
