# A 股指数成分股 Treemap

学习演示项目：申万 **L1→L2→L3→股** 热力图，面积支持 **流通市值 / 成交额**，涨跌按离散档位配色。数据经 **Tushare** 入库；**`TUSHARE_TOKEN` 与数据库连接等**均在仓库根目录 `.env` 配置（见 [`.env.example`](.env.example)）。

## 使用效果（界面展示）

以下为实际运行 Web 前端后的界面示意（与仓库内 [`docs/screenshot-treemap.png`](docs/screenshot-treemap.png) 为同一张截图），便于快速理解产品形态：

| 区域 | 说明 |
|------|------|
| **顶栏** | 指数选择（如中证全指 `000985.SH`）、面积维度（流通市值 / 成交额 / 成分权重）、交易日与数据截止时间、交易中/快照状态；右侧为涨跌幅**色阶图例**。 |
| **统计条** | 成分数量、流通市值与成交额量级、等权涨跌、涨/跌/平家数；可展开「涨跌统计」。 |
| **主云图** | 大块为**申万行业**，内含个股矩形；**面积**对应当前指标，**颜色**对应当日涨跌幅档位；可逐级下钻与返回。 |

![A 股指数云图 — 主界面截图](docs/screenshot-treemap.png)

页面顶栏还提供 **「使用说明」** 入口（弹窗内为简要操作与免责提示）。

## 组件


| 目录                                             | 说明                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `db/migrations`                                | PostgreSQL 初始化 SQL                                                                                              |
| `worker`                                       | Python 3.11 采集；依赖由 **[uv](https://docs.astral.sh/uv/)** 管理（`pyproject.toml` / `uv.lock`）                        |
| `api`                                          | Node 20 + Express BFF，`/api/indices`、`/api/indices/:code/market`（原始成分行情；热力图由前端聚合）                               |
| `web`                                          | React 18 + Vite + Tailwind CSS + TanStack Query + ECharts                                                       |
| `api/src/openapi-spec/` + `api/src/openapi.ts` | OpenAPI：Zod 契约在 `**openapi-spec/`** 分文件维护，入口 `openapi.ts` 导出 `getOpenApiDocument` 与业务类型；`GET /api/openapi.json` |


- **时间窗与预计算（`market`）**
  - `GET /api/indices/{code}/market?window=1d|7d|30d`：读表 `market_constituent_rollups`（1/7/30 **交易日** 窗，由 [worker 晚盘/灌库](worker/app/scheduled_jobs.py) 在 `quotes_daily` 更新后重算，避免每次请求在线聚合；`1d` 无预计算行时回退为旧版「rt ∪ daily 最新」查询。
  - `GET /api/indices/{code}/market?tradeDate=YYYY-MM-DD`：单日历史，仍只读 `quotes_daily`（**忽略** `window`）。
  - `GET /api/indices/{code}/market/rt`：与「rt ∪ daily 最新」一致（**结构同** `market` live）；盘中用 `quotes_rt`，晚盘 `quotes_rt` 清空后走 `quotes_daily` 当日。
  - 新库/升级请按序执行 [db/migrations](db/migrations)（`001`…`006` 等，见目录内文件名）；`docker compose` 的 `db` 镜像在构建时把 `db/migrations` 复制进 `docker-entrypoint-initdb.d`，**仅在新数据目录首次初始化**时按文件名顺序执行其中全部 `.sql`；修改 SQL 后需 `docker compose build db`（或 `up --build`）。已有库请按需手动执行尚未应用的脚本。

### OpenAPI → 前端代码生成

- **契约源（手写）**：[api/src/openapi-spec/](api/src/openapi-spec/) 下分 schema / paths 等，入口 [api/src/openapi.ts](api/src/openapi.ts)；路由实现见 [api/src/routes/](api/src/routes/)。改接口后于 `**web/`** 执行 `**npm run gen:api`** 更新 [web/src/api/generated](web/src/api/generated)（BFF 已起、可拉 `/api/openapi.json`）。改接口时改 Zod 与 `register*Path`、及对应 handler。
- **BFF 暴露**（与运行中的实现一致）：
  - `GET /api/openapi.json`
  - `GET /api/docs`（Swagger UI）
- **前端生成**（在 `web/` 下，需已 `npm install`，**且本机 BFF 已监听** `http://127.0.0.1:3001`；输入见 [web/openapi-ts.config.ts](web/openapi-ts.config.ts)）：
  - `npm run gen:api`（即 `openapi-ts`；`OPENAPI_INPUT` 可覆盖输入 URL 或相对 `web/` 的 JSON 路径）
- 生成物：`web/src/api/generated/`（`types.gen.ts`、`sdk.gen.ts`、fetch 客户端等），业务侧可继续通过 [web/src/lib/api.ts](web/src/lib/api.ts) 封装调用。

### 后端（Node）返回类型

BFF 在 [api/src/openapi-spec/setup.ts](api/src/openapi-spec/setup.ts) 内用 **Zod `z.infer<typeof …Schema>`** 经 [api/src/openapi.ts](api/src/openapi.ts) 再导出 `IndicesResponse`、`MarketSnapshotResponse` 等，**与 OpenAPI 文档同源**，无需在 `api` 下再跑 codegen。  
**生成客户端与前端类型**只在 `**web/`** 下执行 `**npm run gen:api`**（需 BFF 已起，见上）。

## 本地开发

1. **数据库（Docker）**（推荐）：
  ```bash
   docker compose -f docker-compose.db.yml up -d
  ```
   首次启动会在空数据目录上自动执行镜像内迁移 SQL（与 [db/migrations](db/migrations) 一致，按文件名排序）。连接串：`postgresql://postgres:postgres@localhost:5432/index_atlas`（与根目录 [`.env.example`](.env.example) 中 `DATABASE_URL` 一致）。停止：`docker compose -f docker-compose.db.yml down`（数据在卷 `pgdata` 中；需清空可加 `-v`）。本地跑 api/worker 时可在根目录 `cp .env.example .env` 后填同一连接串。
   若不用 Docker，可自行安装 PostgreSQL 并手动执行同一 SQL。
2. **环境变量**：在**仓库根目录**执行 `cp .env.example .env`，填写 `TUSHARE_TOKEN`、`DATABASE_URL`（及按需调整 API 端口等）。
3. **Worker**：安装 [uv](https://docs.astral.sh/uv/getting-started/installation/) 后：
  ```bash
   cd worker
   uv sync && uv run python -m app.main
  ```
   详见 `[worker/README.md](worker/README.md)`。
4. API：`cd api && npm install && npm run dev`（从根目录 `.env` 读取配置）。
5. 前端：`cd web && npm install && npm run dev`（Vite 将 `/api` 代理到 `http://127.0.0.1:3001`）。若需更新前端的 `gen:api` 产物，在 BFF 已起时于 `web/` 下执行 `npm run gen:api`。

生产构建的 Web 通过 Nginx 反代 `/api`，无需设置 `VITE_API_BASE`。

## Docker Compose

在项目根目录创建 `.env`（复制 `.env.example`），至少设置 `TUSHARE_TOKEN`；`api` / `worker` 服务会通过 `env_file` 读入该文件，compose 内仍会覆盖 `DATABASE_URL` 指向 `db` 容器。

```bash
docker compose up --build
```

- 前端：[http://localhost:8080](http://localhost:8080)
- API 直连：[http://localhost:3001/api/indices](http://localhost:3001/api/indices)
- OpenAPI：Swagger [http://localhost:3001/api/docs](http://localhost:3001/api/docs) · [http://localhost:3001/api/openapi.json](http://localhost:3001/api/openapi.json)（经 Nginx 时用 `8080` 同源路径即可）

`worker` 在无 `TUSHARE_TOKEN` 时会退出；配置 token 后重新 `docker compose up worker`。

## 免责声明

界面与 README 所述：本项目**不构成投资建议**，数据**不保证**准确与实时。详见 `web` 页脚与首次打开对话框文案。