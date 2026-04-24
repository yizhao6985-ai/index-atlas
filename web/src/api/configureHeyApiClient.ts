import { client } from "./generated/client.gen";

/** 在 `main.ts` 最早调用：与 Vite 代理 / Nginx 同源的相对路径，或通过 `VITE_API_BASE` 指向前缀 */
export function configureHeyApiClient() {
  client.setConfig({
    baseUrl: import.meta.env.VITE_API_BASE ?? "",
  });
}
