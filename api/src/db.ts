/**
 * 共享 `pg.Pool`：全应用单例，供路由与服务层复用。
 */
import pg from "pg";

import { DATABASE_URL } from "./config.js";

export const pool = new pg.Pool({ connectionString: DATABASE_URL });
