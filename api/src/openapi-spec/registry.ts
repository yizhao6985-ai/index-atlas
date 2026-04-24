import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

/** 全项目共用一个 Registry，供组件 schema 与 paths 挂接 */
export const registry = new OpenAPIRegistry();
