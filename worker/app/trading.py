from __future__ import annotations

import datetime
from zoneinfo import ZoneInfo

from chinese_calendar import is_workday

CN_TZ = ZoneInfo("Asia/Shanghai")


def is_trading_session(now: datetime.datetime | None = None) -> bool:
    """Rough A-share session: workday + 09:30–11:30, 13:00–15:00 CST."""
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

    t = now.time()
    morning = datetime.time(9, 30) <= t <= datetime.time(11, 30)
    afternoon = datetime.time(13, 0) <= t <= datetime.time(15, 0)
    return morning or afternoon


def today_trade_date(now: datetime.datetime | None = None) -> datetime.date:
    if now is None:
        now = datetime.datetime.now(CN_TZ)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=CN_TZ)
    else:
        now = now.astimezone(CN_TZ)
    return now.date()
