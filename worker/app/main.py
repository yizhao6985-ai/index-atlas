from __future__ import annotations

import logging
import sys

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
from app.trading import is_trading_session
from app.tushare_sync import sync_rt_k_snapshot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    stream=sys.stdout,
)
# 避免非交易时段每 10s 一条「Running job job_rt_k / executed successfully」误导为在同步
logging.getLogger("apscheduler.executors.default").setLevel(logging.WARNING)
log = logging.getLogger("worker")


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

    if settings.require_data_on_start:
        require_treemap_data_or_exit()
    else:
        log.warning(
            "WORKER_REQUIRE_DATA_CHECK 已关闭：不强制要求已有成分与行情，定时任务仍会请求 Tushare"
        )

    if settings.rt_k_interval_sec > 0 and is_trading_session():
        log.info("当前为交易时段，启动后立即执行一轮 rt_k")
        try:
            sync_rt_k_snapshot()
        except Exception:
            log.exception("启动时 rt_k 失败")
    elif settings.rt_k_interval_sec == 0:
        log.info("RT_K_INTERVAL_SEC=0：不轮询 rt_k，盘中无实时入库")

    sched = BlockingScheduler(timezone="Asia/Shanghai")
    if settings.rt_k_interval_sec > 0:
        sched.add_job(
            job_rt_k,
            "interval",
            seconds=settings.rt_k_interval_sec,
            max_instances=1,
            coalesce=True,
        )
        log.info(
            "rt_k(doc 372) 已启用：交易时段每 %ss 一轮；收盘后由 16:15 任务写入 quotes_daily 并清空 quotes_rt",
            settings.rt_k_interval_sec,
        )
    else:
        log.info(
            "rt_k 已关闭（RT_K_INTERVAL_SEC=0）。"
            "低档积分易限流；收盘后仍由 16:15 任务更新 quotes_daily"
        )
    sched.add_job(
        job_evening,
        CronTrigger(hour=16, minute=15, day_of_week="mon-fri"),
    )
    sched.start()


if __name__ == "__main__":
    main()
