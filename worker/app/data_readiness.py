"""启动前校验库内是否具备 treemap 所需最小数据（与 API 侧一致）。"""

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass

from psycopg.rows import dict_row

from app.db import connect

log = logging.getLogger(__name__)


def treemap_data_counts() -> tuple[int, int]:
    """返回 (index_constituents 行数, quotes_daily+quotes_rt 行数合计)。"""
    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                  (SELECT COUNT(*)::bigint FROM index_constituents) AS constituents,
                  (
                    (SELECT COUNT(*)::bigint FROM quotes_daily)
                    + (SELECT COUNT(*)::bigint FROM quotes_rt)
                  ) AS quotes
                """
            )
            row = cur.fetchone()
    c = int(row["constituents"] or 0) if row else 0
    q = int(row["quotes"] or 0) if row else 0
    return c, q


def require_treemap_data_or_exit() -> None:
    """无成分或行情则退出进程（请先运行 scripts/bootstrap_local_data.py）。"""
    c, q = treemap_data_counts()
    if c >= 1 and q >= 1:
        log.info(
            "data readiness ok: index_constituents=%s quotes_rows=%s",
            c,
            q,
        )
        return
    log.error(
        "缺少 treemap 依赖数据（index_constituents=%s, quotes_daily+quotes_rt=%s）。"
        "请一次性灌库：cd worker && uv run python scripts/bootstrap_local_data.py",
        c,
        q,
    )
    sys.exit(1)


@dataclass(frozen=True)
class BootstrapDataSnapshot:
    n_indices: int
    n_constituents: int
    n_constituents_with_weight: int
    n_share_premarket: int
    n_quotes: int
    n_latest_constituent_codes: int
    n_constituent_codes_with_sw_l1: int


def fetch_bootstrap_data_snapshot() -> BootstrapDataSnapshot:
    """指数、成分与权重、自由流通股本表、行情、最新成分上是否具备申万一级行业。"""
    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                  (SELECT COUNT(*)::bigint FROM indices) AS n_indices,
                  (SELECT COUNT(*)::bigint FROM index_constituents) AS n_constituents,
                  (SELECT COUNT(*)::bigint FROM index_constituents WHERE weight IS NOT NULL)
                    AS n_constituents_with_weight,
                  (SELECT COUNT(*)::bigint FROM share_premarket) AS n_share_premarket,
                  (
                    (SELECT COUNT(*)::bigint FROM quotes_daily)
                    + (SELECT COUNT(*)::bigint FROM quotes_rt)
                  ) AS n_quotes
                """
            )
            row = cur.fetchone() or {}

            cur.execute(
                """
                WITH latest AS (
                  SELECT index_id, MAX(trade_date) AS td
                  FROM index_constituents
                  GROUP BY index_id
                ),
                codes AS (
                  SELECT DISTINCT ic.con_code AS con_code
                  FROM index_constituents ic
                  JOIN latest l ON l.index_id = ic.index_id AND l.td = ic.trade_date
                )
                SELECT
                  (SELECT COUNT(*)::bigint FROM codes) AS n_codes,
                  (
                    SELECT COUNT(*)::bigint
                    FROM codes c
                    INNER JOIN stocks s ON s.ts_code = c.con_code
                    WHERE s.sw_l1_code IS NOT NULL
                      AND trim(s.sw_l1_code::text) <> ''
                  ) AS n_with_sw
                """
            )
            sw = cur.fetchone() or {}

    return BootstrapDataSnapshot(
        n_indices=int(row.get("n_indices") or 0),
        n_constituents=int(row.get("n_constituents") or 0),
        n_constituents_with_weight=int(row.get("n_constituents_with_weight") or 0),
        n_share_premarket=int(row.get("n_share_premarket") or 0),
        n_quotes=int(row.get("n_quotes") or 0),
        n_latest_constituent_codes=int(sw.get("n_codes") or 0),
        n_constituent_codes_with_sw_l1=int(sw.get("n_with_sw") or 0),
    )


def bootstrap_gap_reasons(s: BootstrapDataSnapshot) -> list[str]:
    """若返回非空，表示应执行一次完整灌库（与 bootstrap 默认四步一致）。"""
    gaps: list[str] = []
    if s.n_indices < 1:
        gaps.append("indices 表无记录（请先执行数据库迁移）")
    if s.n_constituents < 1:
        gaps.append("无指数成分 index_constituents")
    if s.n_share_premarket < 1:
        gaps.append("无自由流通股本 share_premarket（daily_basic free_share）")
    if s.n_quotes < 1:
        gaps.append("无行情数据 quotes_daily / quotes_rt（须 daily 或 rt_k 灌库）")
    if s.n_latest_constituent_codes > 0 and s.n_constituent_codes_with_sw_l1 < 1:
        gaps.append(
            "最新指数成分在 stocks 中均无申万一级行业（sw_l1_code）；"
            "允许部分个股无行业，但不能全部为空"
        )
    return gaps


def needs_auto_bootstrap() -> bool:
    return len(bootstrap_gap_reasons(fetch_bootstrap_data_snapshot())) > 0
