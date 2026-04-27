# Worker（Python）

使用 [uv](https://docs.astral.sh/uv/) 管理依赖与虚拟环境。默认 PyPI 索引在 `pyproject.toml` 中设为[清华镜像](https://pypi.tuna.tsinghua.edu.cn/simple)（`uv sync` / `uv lock` 会走国内源）；海外环境可改回 `https://pypi.org/simple`，或按 uv 文档设置 `UV_DEFAULT_INDEX` 等变量覆盖。

## 本地运行

推荐使用 **Python 3.11**（与 Docker 一致）。若本机默认是 3.13，请先：

```bash
uv python install 3.11
```

**首次**可任选其一：

1. **仅启动 worker**（默认）：启动时只做**数据快照检查**（`bootstrap_gap_reasons`），**已齐则不打 Tushare**；有缺失才跑与 `bootstrap_local_data.py` 相同的全量四步。若需**每次启动都强制全量刷新**，设 `WORKER_STARTUP_FULL_PREPARE=1`。
2. **手动灌库**（与自动灌库等价，便于排查）：

```bash
# 在仓库根目录：cp .env.example .env，填写 TUSHARE_TOKEN、DATABASE_URL（与 API 同一库）
cd worker
uv sync
uv run python scripts/bootstrap_local_data.py
```

再启动 worker（定时任务仅 **16:15** 收盘同步；若灌库失败或仍缺成分/行情，进程会退出，除非设 `WORKER_ALLOW_EMPTY_DB=1`）：

```bash
uv run python -m app.main
```

- 关闭启动时按需灌库：`WORKER_AUTO_BOOTSTRAP=0`（空库请事先手动跑 `bootstrap_local_data.py`）。
- 空库或灌库失败仍要起进程（不推荐）：`WORKER_ALLOW_EMPTY_DB=1`。

启动 **API** 前库中也须有成分与行情，否则进程退出；仅调试可设 `BFF_SKIP_DATA_CHECK=1`。

首次导入 `psycopg` 可能需数秒，请等日志出现再操作；不要急于中断。

### Tushare 权限与积分

流通股本来自 `**daily_basic`** [doc 32](https://tushare.pro/document/2?doc_id=32) 的 `**float_share`（万股）**，写入 `share_premarket`（与 `circ_mv` 公式一致）。申万行业来自 `**index_classify`** [181](https://tushare.pro/document/2?doc_id=181) + `**index_member_all`** [335](https://tushare.pro/document/2?doc_id=335)，写入 `stocks.sw_l1/l2/l3`_*。`**rt_k*`* [372](https://tushare.pro/document/2?doc_id=372) 等亦有积分要求，见 [权限说明](https://tushare.pro/document/1?doc_id=108)。

- 若无 `**daily_basic`** 权限：`circ_mv` 可能为空，热力图请用 **「成交额」** 作面积。
- **行情表拆分**：`**quotes_daily`** 存 Tushare **daily（doc 27）** 历史日线，供 API `?tradeDate=` 与保留窗口裁剪；`**quotes_rt`** 存 **rt_k（doc 372）** 盘中实时快照。BFF 默认大盘接口优先读 `quotes_rt`，无则回退 `quotes_daily` 最新收盘。
- `**bootstrap_local_data.py`**：手动全量初始化，逻辑与 worker 启动准备一致。
- **盘中**：默认 `**RT_K_INTERVAL_SEC=10**`：后台线程使**相邻两轮 `job_rt_k` 开始**约隔该秒数；本轮请求+写库耗时从间隔中扣除，仅 **sleep 剩余时间**。**rt_k** 单次请求逗号拼接成分并集（接口约 6000 条/次）。**仅**在 `is_trading_session()` 内才会真正请求 **rt_k**（低档积分请设 `RT_K_INTERVAL_SEC=0`）。
- **收盘**：工作日 **16:15** 任务：`index_weight` → 申万 → `daily_basic`（流通股本）→ **daily** 更新 `quotes_daily` 并裁剪约 30 交易日 → `**TRUNCATE quotes_rt`**（日线已落库，清空实时表）。
- 申万默认 `SHENWAN_MEMBER_QUERY_LEVEL=L1`，`SHENWAN_MEMBER_INTERVAL_SEC=0.3`。旧库若仍有 `quotes_snapshot`，执行 `db/migrations/003_quotes_split_snapshot_to_daily_rt.sql`（必要时先 `002`）。

**Treemap 仍为空**时，多半是未灌库或 Tushare 权限不足。重新执行全量脚本即可（会刷新成分、行业、股本与约 30 日日线并裁剪）：

```bash
cd worker
uv run python scripts/bootstrap_local_data.py
```

**API 与 worker 必须指向同一 `DATABASE_URL`**（例如都连本机 Docker 里的 Postgres）。

更新依赖锁文件（改 `pyproject.toml` 后）：

```bash
uv lock
```

## Docker

见仓库根目录 `worker/Dockerfile`（镜像内 `uv sync --frozen`）。