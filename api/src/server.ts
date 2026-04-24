/**
 * 进程入口：在监听端口前先校验库内是否有足够数据支撑行情接口，避免空库误启动。
 */
import { PORT } from "./config.js";
import { pool } from "./db.js";
import { createApp } from "./app.js";
import { assertTreemapDataReady } from "./services/dataReadiness.js";

const app = createApp(pool);

// 未灌库时直接退出，便于本地/CI 快速发现数据问题
assertTreemapDataReady(pool)
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `api listening on :${PORT} (Swagger: /api/docs, spec: /api/openapi.json)`,
      );
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
