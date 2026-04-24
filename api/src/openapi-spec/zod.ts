/**
 * 必须在其它 openapi 模块之前加载：为 Zod 注入 `.openapi()`。
 */
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export { z };
