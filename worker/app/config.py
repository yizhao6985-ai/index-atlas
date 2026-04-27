import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def _env_int(key: str, default: int) -> int:
    v = os.environ.get(key)
    if v is None or str(v).strip() == "":
        return default
    try:
        return max(0, int(str(v).strip(), 10))
    except ValueError:
        return default


def _env_bool(key: str, default: bool) -> bool:
    v = os.environ.get(key)
    if v is None or str(v).strip() == "":
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    tushare_token: str
    database_url: str
    # RT_K_INTERVAL_SEC：相邻两轮 rt_k 开始时刻的目标间隔（秒）；一轮内耗时从该间隔内扣除，0=关闭
    rt_k_interval_sec: int = 10
    # WORKER_REQUIRE_DATA_CHECK：启动前要求库内已有成分与行情，默认开
    require_data_on_start: bool = True
    # WORKER_STARTUP_FULL_PREPARE：每次启动都全量灌库（强制打 Tushare）；默认关，避免数据已齐仍重复请求
    startup_full_prepare: bool = False
    # WORKER_AUTO_BOOTSTRAP：启动时检查数据快照，仅在有缺失时灌库（与 bootstrap_gap_reasons 一致），默认开
    auto_bootstrap: bool = True
    # daily(doc 27)：表中保留的「交易日」种类上限（distinct trade_date），超出则删更旧日期
    quotes_daily_retention_trade_days: int = 30
    # 初始化灌库时回填的交易日数量（有数据的交易日计 success，会多扫若干工作日以跳过节假日空窗）
    quotes_daily_bootstrap_trade_days: int = 30
    # QUOTES_DAILY_FULL_MARKET=0 时仅写入指数最新成分并集；默认 1=全市场（接口单次按 trade_date 全市场）
    quotes_daily_full_market: bool = True
    index_weight_codes: tuple[str, ...] = (
        "000985.SH",
        "000001.SH",
        "399001.SZ",
        "000300.SH",
        "000905.SH",
        "000852.SH",
        "399006.SZ",
        "000688.SH",
    )


def get_settings() -> Settings:
    token = os.environ.get("TUSHARE_TOKEN", "").strip()
    if not token:
        raise RuntimeError("TUSHARE_TOKEN is required")
    db = os.environ.get("DATABASE_URL", "").strip()
    if not db:
        raise RuntimeError("DATABASE_URL is required")
    return Settings(
        tushare_token=token,
        database_url=db,
        rt_k_interval_sec=_env_int("RT_K_INTERVAL_SEC", 10),
        require_data_on_start=_env_bool("WORKER_REQUIRE_DATA_CHECK", True),
        startup_full_prepare=_env_bool("WORKER_STARTUP_FULL_PREPARE", False),
        auto_bootstrap=_env_bool("WORKER_AUTO_BOOTSTRAP", True),
        quotes_daily_retention_trade_days=max(1, _env_int("QUOTES_DAILY_RETENTION_TRADE_DAYS", 30)),
        quotes_daily_bootstrap_trade_days=max(1, _env_int("QUOTES_DAILY_BOOTSTRAP_TRADE_DAYS", 30)),
        quotes_daily_full_market=_env_bool("QUOTES_DAILY_FULL_MARKET", True),
    )


settings = get_settings()
