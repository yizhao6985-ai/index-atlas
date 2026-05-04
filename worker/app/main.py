from __future__ import annotations

import logging
import sys
import threading
import time

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.bootstrap_pipeline import run_full_bootstrap
from app.config import settings
from app.data_readiness import (
    bootstrap_gap_reasons,
    fetch_bootstrap_data_snapshot,
    require_treemap_data_or_exit,
)
from app.scheduled_jobs import job_evening, job_rt_k
from app.trade_calendar_sync import sync_trade_cal_month_window

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    stream=sys.stdout,
)
# 避免非交易时段一条「Running job … / executed successfully」误导为在同步
logging.getLogger("apscheduler.executors.default").setLevel(logging.WARNING)
log = logging.getLogger("worker")


def _rt_k_poll_loop(interval_sec: int) -> None:
    """相邻两轮 `job_rt_k` **开始**时刻目标间隔 `interval_sec` 秒。
    一轮内请求+写库耗时计入该间隔；仅当耗时不足时才 sleep 补足，避免变成「写库后再多等满 interval」。"""
    while True:
        t0 = time.monotonic()
        try:
            job_rt_k()
        except Exception:
            log.exception("rt_k poll loop: job_rt_k failed")
        elapsed = time.monotonic() - t0
        time.sleep(max(0.0, float(interval_sec) - elapsed))


def main() -> None:
    log.info("worker starting; indices=%s", settings.index_weight_codes)

    if settings.startup_full_prepare:
        log.info(
            "WORKER_STARTUP_FULL_PREPARE=1：每次启动强制全量灌库（与 bootstrap_local_data 一致），将请求 Tushare"
        )
        try:
            run_full_bootstrap(log)
        except Exception:
            log.exception("启动全量准备失败（将继续做启动校验）")
    elif settings.auto_bootstrap:
        snap = fetch_bootstrap_data_snapshot()
        gaps = bootstrap_gap_reasons(snap)
        if gaps:
            log.info(
                "检测到数据不完整，自动灌库。快照: indices=%s constituents=%s "
                "share_premarket=%s quotes=%s 成分股数=%s 有申万一级=%s",
                snap.n_indices,
                snap.n_constituents,
                snap.n_share_premarket,
                snap.n_quotes,
                snap.n_latest_constituent_codes,
                snap.n_constituent_codes_with_sw_l1,
            )
            for g in gaps:
                log.info("  缺失: %s", g)
            try:
                run_full_bootstrap(log)
            except Exception:
                log.exception("自动灌库失败（将继续做启动校验）")
        else:
            log.info(
                "启动检查：灌库数据已齐，跳过 Tushare 灌库。快照 constituents=%s quotes=%s "
                "share_premarket=%s 申万覆盖成分=%s/%s",
                snap.n_constituents,
                snap.n_quotes,
                snap.n_share_premarket,
                snap.n_constituent_codes_with_sw_l1,
                snap.n_latest_constituent_codes,
            )
    else:
        log.info("WORKER_AUTO_BOOTSTRAP=0：启动时不做灌库检查与请求（WORKER_STARTUP_FULL_PREPARE 亦为 0）")

    if settings.allow_empty_db:
        log.warning(
            "WORKER_ALLOW_EMPTY_DB=1：跳过库内成分/行情校验，定时任务仍会请求 Tushare（勿用于生产）"
        )
    else:
        require_treemap_data_or_exit()

    try:
        log.info("startup: sync trade_cal(doc 26) month window")
        sync_trade_cal_month_window()
    except Exception:
        log.exception("startup: trade_cal(doc 26) sync failed（rt_k 将暂用工作日 fallback 直至 evening 成功）")

    sched = BlockingScheduler(timezone="Asia/Shanghai")
    if settings.rt_k_interval_sec > 0:
        threading.Thread(
            target=_rt_k_poll_loop,
            args=(settings.rt_k_interval_sec,),
            name="rt_k_poll",
            daemon=True,
        ).start()
        log.info(
            "rt_k(doc 372) 已启用：相邻两轮开始目标间隔 %ss；"
            "仅在连续竞价且库内 SSE 日历判定为交易日时请求 rt_k（同日开市判断内存缓存）；"
            "trade_cal 在启动与 16:15 evening 同步",
            settings.rt_k_interval_sec,
        )
    else:
        log.info(
            "RT_K_INTERVAL_SEC=0：不轮询 rt_k（盘中无实时入库）。"
            "低档积分易限流；收盘后仍由 16:15 任务更新 quotes_daily"
        )
    sched.add_job(
        job_evening,
        CronTrigger(hour=16, minute=15, day_of_week="mon-fri"),
    )
    sched.start()


if __name__ == "__main__":
    main()
