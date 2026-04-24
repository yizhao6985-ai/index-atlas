"""Tushare 拉数入库：成分、股本、申万、实时/日线行情。"""

from __future__ import annotations

import datetime
import logging
import time
from decimal import Decimal

from psycopg.rows import dict_row

from app.config import settings
from app.db import connect, exec_sql
from app.sync_common import (
    calc_circ_mv,
    calc_pct,
    chunks,
    ensure_stock_stub,
    fetch_constituent_union_codes,
    last_n_workdays_newest_first,
    parse_tushare_date,
    quotes_workday_candidates,
    str_or_none,
    to_dec,
)
from app.trading import today_trade_date
from app.tushare_client import (
    BATCH_RT,
    INDEX_MEMBER_ALL_MIN_INTERVAL_SEC,
    index_member_all_fetch_one,
    is_tushare_permission_error,
    is_tushare_rate_limit_error,
    retry_df,
    tushare_pro,
)

log = logging.getLogger(__name__)

_QUOTES_DAILY_UPSERT_SQL = """
                INSERT INTO quotes_daily (
                  trade_date, snapshot_at, stock_code, pre_close, close, pct_change, amount, vol, circ_mv
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (trade_date, stock_code) DO UPDATE SET
                  snapshot_at = EXCLUDED.snapshot_at,
                  pre_close = EXCLUDED.pre_close,
                  close = EXCLUDED.close,
                  pct_change = EXCLUDED.pct_change,
                  amount = EXCLUDED.amount,
                  vol = EXCLUDED.vol,
                  circ_mv = EXCLUDED.circ_mv
                """

_QUOTES_RT_UPSERT_SQL = """
                INSERT INTO quotes_rt (
                  trade_date, snapshot_at, stock_code, pre_close, close, pct_change, amount, vol, circ_mv
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (trade_date, stock_code) DO UPDATE SET
                  snapshot_at = EXCLUDED.snapshot_at,
                  pre_close = EXCLUDED.pre_close,
                  close = EXCLUDED.close,
                  pct_change = EXCLUDED.pct_change,
                  amount = EXCLUDED.amount,
                  vol = EXCLUDED.vol,
                  circ_mv = EXCLUDED.circ_mv
                """


def _load_latest_float_map() -> dict[str, Decimal]:
    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (ts_code) ts_code, float_share
                FROM share_premarket
                ORDER BY ts_code, trade_date DESC
                """
            )
            return {r["ts_code"]: Decimal(str(r["float_share"])) for r in cur.fetchall()}


def _daily_code_filter() -> set[str] | None:
    """全市场返回 None；仅成分股时返回代码集合。"""
    if settings.quotes_daily_full_market:
        return None
    codes = fetch_constituent_union_codes()
    return set(codes) if codes else set()


def prune_quotes_daily_to_retention() -> None:
    """quotes_daily：仅保留最近 N 个 distinct trade_date，更旧整日删除。"""
    keep = settings.quotes_daily_retention_trade_days
    if keep < 1:
        return
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT trade_date
                FROM quotes_daily
                ORDER BY trade_date DESC
                """
            )
            dates = [r["trade_date"] for r in cur.fetchall()]
            if len(dates) <= keep:
                return
            oldest_keep = dates[keep - 1]
            cur.execute(
                "DELETE FROM quotes_daily WHERE trade_date < %s",
                (oldest_keep,),
            )
            removed = cur.rowcount
    log.info(
        "quotes_daily 已按保留 %s 个交易日裁剪：删除 trade_date < %s（%s 行）",
        keep,
        oldest_keep,
        removed,
    )


def clear_quotes_rt() -> None:
    """清空 rt_k 实时表；收盘后日线已写入 quotes_daily 时调用，避免与历史表混用旧快照。"""
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE quotes_rt RESTART IDENTITY")
    log.info("quotes_rt 已 TRUNCATE")


def _ingest_daily_dataframe(
    df,
    float_map: dict[str, Decimal],
    code_filter: set[str] | None,
) -> int:
    """将 daily(doc 27) 单日全市场 DataFrame 写入 quotes_daily（可选仅成分）。"""
    snapshot_at = datetime.datetime.now(datetime.timezone.utc)
    rows_out: list[tuple] = []
    for _, r in df.iterrows():
        stock_code = str(r["ts_code"])
        if code_filter is not None and stock_code not in code_filter:
            continue
        row_td = parse_tushare_date(r["trade_date"])
        pre = to_dec(r.get("pre_close"))
        clo = to_dec(r.get("close"))
        pct_raw = to_dec(r.get("pct_chg"))
        pct = pct_raw if pct_raw is not None else calc_pct(pre, clo)
        amount = to_dec(r.get("amount"))
        vol = to_dec(r.get("vol"))
        fs = float_map.get(stock_code)
        circ = calc_circ_mv(fs, clo)
        rows_out.append(
            (row_td, snapshot_at, stock_code, pre, clo, pct, amount, vol, circ)
        )
    if not rows_out:
        return 0
    with connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(_QUOTES_DAILY_UPSERT_SQL, rows_out)
    return len(rows_out)


def sync_index_weight() -> None:
    """Pull index_weight for each configured index; latest trade_date from API."""
    pro = tushare_pro()
    with connect() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT id, code, tushare_index_code FROM indices ORDER BY sort_order")
            rows = cur.fetchall()

        for row in rows:
            idx_id = row["id"]
            tushare_code = row["tushare_index_code"] or row["code"]
            df = retry_df(lambda: pro.index_weight(index_code=tushare_code))
            if df is None or df.empty:
                log.warning("index_weight empty for %s", tushare_code)
                continue
            df = df.sort_values("trade_date", ascending=False)
            latest_raw = df.iloc[0]["trade_date"]
            latest = parse_tushare_date(latest_raw)
            sub = df[df["trade_date"] == latest_raw]
            log.info("index_weight %s rows=%s date=%s", tushare_code, len(sub), latest)

            for _, r in sub.iterrows():
                con_code = str(r["con_code"])
                w = r["weight"] if "weight" in r and r["weight"] == r["weight"] else None
                ensure_stock_stub(conn, con_code)
                exec_sql(
                    conn,
                    """
                    INSERT INTO index_constituents (index_id, con_code, trade_date, weight)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (index_id, con_code, trade_date)
                    DO UPDATE SET weight = EXCLUDED.weight
                    """,
                    (idx_id, con_code, latest, w),
                )


def sync_share_float_daily_basic(for_date: datetime.date | None = None) -> None:
    """
    使用 daily_basic（doc 32）全市场单次请求写入 float_share（万股）→ share_premarket。
    `ts_code=''` + `trade_date` 一次拉取当日全部标的（接口上限约 6000 条/次）。
    https://tushare.pro/document/2?doc_id=32
    """
    pro = tushare_pro()
    anchor = for_date or today_trade_date()
    candidates = quotes_workday_candidates(for_date)

    for try_d in candidates:
        ds = try_d.strftime("%Y%m%d")
        try:
            df = retry_df(
                lambda s=ds: pro.daily_basic(
                    ts_code="",
                    trade_date=s,
                    fields="ts_code,trade_date,float_share",
                )
            )
        except Exception as e:
            if is_tushare_permission_error(e):
                log.warning(
                    "daily_basic skipped: 无接口权限或积分不足 (doc 32)。"
                    "circ_mv 可能为空；说明 https://tushare.pro/document/1?doc_id=108"
                )
                return
            raise
        if df is None or df.empty:
            log.warning("daily_basic float_share: no rows for trade_date=%s, try earlier day", ds)
            continue

        total = 0
        with connect() as conn:
            for _, r in df.iterrows():
                ts_code = str(r["ts_code"])
                row_td = parse_tushare_date(r["trade_date"])
                fs = r["float_share"]
                if fs is None or (isinstance(fs, float) and fs != fs):
                    continue
                ensure_stock_stub(conn, ts_code)
                exec_sql(
                    conn,
                    """
                    INSERT INTO share_premarket (trade_date, ts_code, float_share)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (trade_date, ts_code)
                    DO UPDATE SET float_share = EXCLUDED.float_share
                    """,
                    (row_td, ts_code, fs),
                )
                total += 1

        if total > 0:
            log.info(
                "daily_basic float_share upserted %s rows (api rows=%s, query trade_date=%s)",
                total,
                len(df),
                ds,
            )
            return

        log.warning("daily_basic float_share: no valid float_share for trade_date=%s", ds)

    log.warning(
        "daily_basic float_share: exhausted candidates from %s; no data (doc 32)",
        anchor,
    )


def sync_index_member_all(codes: list[str] | None = None) -> None:
    """
    index_member_all(doc 335)：按单只 ts_code 拉申万并写入 stocks。
    codes=None：拉当前成分并集（无则退化为全表 stocks）；传列表则只更新这些（常用于只补缺）。
    """
    pro = tushare_pro()
    if codes is not None:
        codes = sorted(set(codes))
        if not codes:
            log.info("index_member_all: 无待补股票，跳过（申万已写入库则启动后只读 DB 即可）")
            return
    else:
        codes = fetch_constituent_union_codes()
        if not codes:
            with connect() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute("SELECT ts_code FROM stocks ORDER BY ts_code")
                    codes = [r["ts_code"] for r in cur.fetchall()]
        if not codes:
            log.warning("no stocks for index_member_all")
            return
        codes = sorted(set(codes))
    n = len(codes)
    log.info(
        "index_member_all(doc 335): %s 只股票，间隔 %.1fs，约 %.1f 小时（"
        "积分档低时该接口常为 1 次/分钟，可调 INDEX_MEMBER_ALL_MIN_INTERVAL_SEC）",
        n,
        INDEX_MEMBER_ALL_MIN_INTERVAL_SEC,
        (n * INDEX_MEMBER_ALL_MIN_INTERVAL_SEC) / 3600,
    )
    api_hits = 0
    with connect() as conn:
        for i, ts_code in enumerate(codes, 1):
            if i == 1 or i % 100 == 0 or i == n:
                log.info("index_member_all progress %s/%s", i, n)
            try:
                df = index_member_all_fetch_one(pro, ts_code)
            except Exception as e:
                if is_tushare_permission_error(e):
                    log.warning(
                        "index_member_all skipped: 无接口权限或积分不足 (doc 335)。"
                        "申万行业树将缺失，热力图行业层级显示为「未分类」。"
                    )
                    return
                raise
            if df is not None and not df.empty:
                api_hits += 1
                for _, r in df.iterrows():
                    row_code = str(r["ts_code"])
                    name = str(r["name"]) if "name" in r else row_code
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
            if i < n:
                time.sleep(INDEX_MEMBER_ALL_MIN_INTERVAL_SEC)
    log.info("index_member_all done: non-empty responses=%s / %s requests", api_hits, n)


def sync_rt_k_snapshot() -> None:
    """rt_k（doc 372）按批拉实时行情 → quotes_rt。低档积分常限 1 次/分钟或/小时。"""
    pro = tushare_pro()
    trade_d = today_trade_date()
    snapshot_at = datetime.datetime.now(datetime.timezone.utc)

    codes = fetch_constituent_union_codes()
    float_map = _load_latest_float_map()

    if not codes:
        log.warning("sync_rt_k: no constituents")
        return

    rows_out: list[tuple] = []
    for chunk in chunks(codes, BATCH_RT):
        joined = ",".join(chunk)
        try:
            df = retry_df(lambda: pro.rt_k(ts_code=joined))
        except Exception as e:
            if is_tushare_permission_error(e):
                log.warning(
                    "rt_k skipped: 无接口权限或积分不足 (doc 372)。"
                    "见 https://tushare.pro/document/1?doc_id=108"
                )
                return
            if is_tushare_rate_limit_error(e):
                log.warning(
                    "rt_k(doc 372) 限流：%s。低档常为每分钟/每小时 1 次，"
                    "请设环境变量 RT_K_INTERVAL_SEC=0 关闭本定时任务，"
                    "或收盘后由 worker 写入 quotes_daily；亦可手动 uv run python scripts/bootstrap_local_data.py。",
                    e,
                )
                return
            raise
        if df is None or df.empty:
            continue
        for _, r in df.iterrows():
            stock_code = str(r["ts_code"])
            pre = to_dec(r.get("pre_close"))
            clo = to_dec(r.get("close"))
            pct = calc_pct(pre, clo)
            # doc 372：rt_k 的 amount 为「元」；与 daily(doc 27) 的「千元」及 quotes_daily 存库对齐
            amt_yuan = to_dec(r.get("amount"))
            amount = (amt_yuan / Decimal(1000)) if amt_yuan is not None else None
            vol = to_dec(r.get("vol"))
            fs = float_map.get(stock_code)
            circ = calc_circ_mv(fs, clo)
            rows_out.append(
                (trade_d, snapshot_at, stock_code, pre, clo, pct, amount, vol, circ)
            )

    if not rows_out:
        log.warning("sync_rt_k: no rows from API")
        return

    with connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(_QUOTES_RT_UPSERT_SQL, rows_out)
    log.info("quotes_rt inserted %s rows at %s", len(rows_out), snapshot_at)


def sync_quotes_daily_latest_and_prune(for_date: datetime.date | None = None) -> None:
    """
    使用 daily（doc 27）拉取最近可用交易日全市场日线，写入后按配置保留最近 N 个交易日并删除更旧数据。
    日线约当日 15:00–16:00 起陆续可查；适合收盘任务（如 16:15）。
    https://tushare.pro/document/2?doc_id=27
    """
    code_filter = _daily_code_filter()
    if code_filter is not None and not code_filter:
        log.warning(
            "daily quotes: no constituents in DB; run index_weight first or set QUOTES_DAILY_FULL_MARKET=1"
        )
        return

    pro = tushare_pro()
    float_map = _load_latest_float_map()
    anchor = for_date or today_trade_date()
    candidates = quotes_workday_candidates(for_date)

    for try_d in candidates:
        ds = try_d.strftime("%Y%m%d")
        try:
            df = retry_df(lambda s=ds: pro.daily(trade_date=s))
        except Exception as e:
            if is_tushare_permission_error(e):
                log.warning(
                    "daily(doc 27) skipped: 无接口权限或积分不足。"
                    "说明 https://tushare.pro/document/1?doc_id=108"
                )
                return
            raise
        if df is None or df.empty:
            log.warning("daily(doc 27): empty for trade_date=%s, try earlier day", ds)
            continue

        n = _ingest_daily_dataframe(df, float_map, code_filter)
        if n <= 0:
            log.warning(
                "daily(doc 27): no rows after filter for trade_date=%s (constituents / 全市场筛选)",
                ds,
            )
            continue

        log.info(
            "daily(doc 27) quotes_daily %s rows (api rows=%s, trade_date=%s)",
            n,
            len(df),
            ds,
        )
        prune_quotes_daily_to_retention()
        return

    log.warning(
        "daily(doc 27): exhausted workday candidates from %s; no data written",
        anchor,
    )


def sync_quotes_daily_bootstrap_window() -> None:
    """初始化：按工作日倒序向前尝试，直至成功写入配置数量的交易日（默认 30），最后裁剪保留 N 个交易日。"""
    code_filter = _daily_code_filter()
    if code_filter is not None and not code_filter:
        log.warning(
            "daily bootstrap: no constituents; run index_weight first or set QUOTES_DAILY_FULL_MARKET=1"
        )
        return

    need = settings.quotes_daily_bootstrap_trade_days
    scan_days = max(need + 30, 55)
    worklist = last_n_workdays_newest_first(today_trade_date(), scan_days)
    pro = tushare_pro()
    float_map = _load_latest_float_map()
    loaded = 0
    for try_d in reversed(worklist):
        if loaded >= need:
            break
        ds = try_d.strftime("%Y%m%d")
        try:
            df = retry_df(lambda s=ds: pro.daily(trade_date=s))
        except Exception as e:
            if is_tushare_permission_error(e):
                log.warning(
                    "daily(doc 27) bootstrap skipped: 无接口权限或积分不足。"
                    "说明 https://tushare.pro/document/1?doc_id=108"
                )
                return
            raise
        if df is None or df.empty:
            continue
        n = _ingest_daily_dataframe(df, float_map, code_filter)
        if n <= 0:
            continue
        loaded += 1
        log.info(
            "daily(doc 27) bootstrap %s/%s trade_date=%s rows=%s (api %s)",
            loaded,
            need,
            ds,
            n,
            len(df),
        )
    if loaded == 0:
        log.warning(
            "daily(doc 27) bootstrap: no trading day data in last %s workdays",
            scan_days,
        )
    prune_quotes_daily_to_retention()


def sync_quotes_from_daily(for_date: datetime.date | None = None) -> None:
    """兼容旧名：等价于 sync_quotes_daily_latest_and_prune。"""
    sync_quotes_daily_latest_and_prune(for_date)
