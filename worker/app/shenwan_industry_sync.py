"""
申万行业灌库：index_classify(doc 181) + index_member_all(doc 335)。

默认按一级行业批量拉成分（约 30+ 次请求）；可通过环境变量改为按三级行业（更慢、更细）。
写入 stocks.sw_l1/l2/l3_*，便于知道每只股票所属行业。
"""

from __future__ import annotations

import logging
import os
import time

import pandas as pd

from app.db import connect, exec_sql
from app.sync_common import str_or_none
from app.tushare_client import (
    is_tushare_permission_error,
    is_tushare_rate_limit_error,
    retry_df,
    tushare_pro,
)

log = logging.getLogger(__name__)

# SW2021 与 doc 181 示例一致；若接口返回需 .SI 后缀，在 _classify_codes 中规范化
DEFAULT_SW_SRC = os.environ.get("SHENWAN_CLASSIFY_SRC", "SW2021").strip() or "SW2021"
# L1：按一级行业拉成分（请求少）；L3：按三级行业拉（请求多，与 doc 335 示例一致）
MEMBER_QUERY_LEVEL = os.environ.get("SHENWAN_MEMBER_QUERY_LEVEL", "L1").strip().upper() or "L1"
# 按 l1/l2/l3 批量拉 index_member_all 时，分类之间的休眠（秒）。高积分档可 200 次/分钟量级 → 默认 0.3s。
# 与逐股 sync_index_member_all 的 INDEX_MEMBER_ALL_MIN_INTERVAL_SEC（默认 65s）无关。


def _shenwan_category_interval_sec() -> float:
    raw = os.environ.get("SHENWAN_MEMBER_INTERVAL_SEC", "0.3").strip()
    try:
        v = float(raw or "0.3")
    except ValueError:
        v = 0.3
    return max(0.0, v)


def _normalize_sw_index_code(v: object) -> str | None:
    """index_classify / index_member_all 侧行业指数代码，统一成 Tushare 常用形式（含 .SI）。"""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if not s:
        return None
    if "." in s:
        return s
    # 801050 / 850531 等申万行业指数
    if s.isdigit() or (len(s) == 6 and s[:6].isdigit()):
        return f"{s}.SI"
    return s


def _classify_codes(pro, level: str, src: str) -> list[str]:
    df = retry_df(lambda: pro.index_classify(level=level, src=src))
    if df is None or df.empty:
        log.warning("index_classify empty level=%s src=%s", level, src)
        return []
    col = "index_code" if "index_code" in df.columns else None
    if col is None and "industry_code" in df.columns:
        col = "industry_code"
    if col is None:
        log.warning("index_classify: no index_code/industry_code column, cols=%s", list(df.columns))
        return []
    out: list[str] = []
    for raw in df[col].tolist():
        c = _normalize_sw_index_code(raw)
        if c:
            out.append(c)
    return sorted(set(out))


def _filter_active_members(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return df
    out = df
    if "is_new" in out.columns:
        s = out["is_new"].astype(str).str.strip().str.upper()
        out = out[s == "Y"]
    if "out_date" in out.columns:
        od = out["out_date"]
        out = out[pd.isna(od) | (od.astype(str).str.strip() == "")]
    return out


def _upsert_stock_sw_from_row(conn, r: pd.Series) -> None:
    """单行 index_member_all 结果写入 stocks（与 tushare_sync.sync_index_member_all 一致）。"""
    row_code = str(r["ts_code"])
    name_raw = r.get("name")
    if name_raw is None or (isinstance(name_raw, float) and pd.isna(name_raw)):
        name = row_code
    else:
        name = str(name_raw).strip() or row_code
    l1c = str_or_none(r.get("l1_code"))
    l1n = str_or_none(r.get("l1_name"))
    l2c = str_or_none(r.get("l2_code"))
    l2n = str_or_none(r.get("l2_name"))
    l3c = str_or_none(r.get("l3_code"))
    l3n = str_or_none(r.get("l3_name"))

    exec_sql(
        conn,
        """
        INSERT INTO stocks (ts_code, name, sw_l1_code, sw_l1_name, sw_l2_code, sw_l2_name,
          sw_l3_code, sw_l3_name, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
        ON CONFLICT (ts_code) DO UPDATE SET
          name = EXCLUDED.name,
          sw_l1_code = EXCLUDED.sw_l1_code,
          sw_l1_name = EXCLUDED.sw_l1_name,
          sw_l2_code = EXCLUDED.sw_l2_code,
          sw_l2_name = EXCLUDED.sw_l2_name,
          sw_l3_code = EXCLUDED.sw_l3_code,
          sw_l3_name = EXCLUDED.sw_l3_name,
          updated_at = now()
        """,
        (row_code, name, l1c, l1n, l2c, l2n, l3c, l3n),
    )


def _fetch_members_for_category(pro, code: str, level: str) -> pd.DataFrame | None:
    kw: dict[str, str] = {"is_new": "Y"}
    if level == "L1":
        kw["l1_code"] = code
    elif level == "L2":
        kw["l2_code"] = code
    else:
        kw["l3_code"] = code

    def call():
        return pro.index_member_all(**kw)

    try:
        return retry_df(call)
    except Exception as e:
        if is_tushare_permission_error(e):
            log.warning(
                "index_member_all 跳过：无权限或积分不足 (doc 335)。"
                "见 https://tushare.pro/document/1?doc_id=108"
            )
            return None
        if is_tushare_rate_limit_error(e):
            log.warning("index_member_all 限流：%s，等待 65s 后重试本分类", e)
            time.sleep(65)
            return retry_df(call)
        raise


def sync_shenwan_industries_full() -> None:
    """
    拉取申万分类下全部成分，写入 stocks 申万字段。
    使用 index_classify(181) 枚举分类，再 index_member_all(335) 按分类拉成分。
    """
    pro = tushare_pro()
    src = DEFAULT_SW_SRC
    query_level = MEMBER_QUERY_LEVEL if MEMBER_QUERY_LEVEL in ("L1", "L2", "L3") else "L1"

    codes = _classify_codes(pro, query_level, src)
    if not codes:
        log.error("申万行业分类列表为空，跳过（检查 index_classify 权限 doc 181）")
        return

    n = len(codes)
    interval = _shenwan_category_interval_sec()
    sleep_total = max(0.0, (n - 1) * interval) if n > 1 else 0.0
    if sleep_total >= 60:
        eta = "分类间休眠合计约 %.1f 分钟" % (sleep_total / 60)
    else:
        eta = "分类间休眠合计约 %.0f 秒" % sleep_total
    log.info(
        "申万行业同步：src=%s 按 %s 拉成分，共 %s 个分类，分类间隔 %.2fs（%s；遇限流会额外等待）",
        src,
        query_level,
        n,
        interval,
        eta,
    )

    total_rows = 0
    for i, code in enumerate(codes, 1):
        df = _fetch_members_for_category(pro, code, query_level)
        if df is None:
            return
        if df.empty:
            log.warning("index_member_all 空结果 %s=%s (%s/%s)", query_level, code, i, n)
        else:
            df = _filter_active_members(df)
            with connect() as conn:
                for _, r in df.iterrows():
                    _upsert_stock_sw_from_row(conn, r)
                    total_rows += 1
            log.info(
                "申万成分 %s=%s 写入 %s 行（过滤后）(%s/%s）",
                query_level,
                code,
                len(df),
                i,
                n,
            )
        if i < n and interval > 0:
            time.sleep(interval)

    log.info("申万行业同步完成：累计写入/更新约 %s 条成分行（去重按 ts_code）", total_rows)
