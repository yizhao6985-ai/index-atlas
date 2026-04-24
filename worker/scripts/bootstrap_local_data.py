#!/usr/bin/env python3
"""本地灌库：一次性全量初始化（无子命令、无选择性同步）。

顺序（均为拉取接口当前可得最新数据，日线窗口见环境变量）：
  1. index_weight → 指数最新成分与权重
  2. 申万行业 → stocks.sw_*（最新行业分类与成分）
  3. daily_basic → share_premarket（最新流通股本）
  4. daily(doc 27) → quotes_daily：回填约 QUOTES_DAILY_BOOTSTRAP_TRADE_DAYS 个交易日，
     结束后按 QUOTES_DAILY_RETENTION_TRADE_DAYS 删除更早交易日的整表数据（默认均 30）。

实时行情 quotes_rt 由 worker 盘中 rt_k(doc 372) 写入，本脚本不处理。

用法（worker 目录，需 .env：TUSHARE_TOKEN、DATABASE_URL）：

  uv run python scripts/bootstrap_local_data.py
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("bootstrap")

from app.bootstrap_pipeline import run_full_bootstrap  # noqa: E402


def main() -> None:
    run_full_bootstrap(log)
    log.info("done; 可重启 API，并 GET /api/indices/000985.SH/market")


if __name__ == "__main__":
    main()
