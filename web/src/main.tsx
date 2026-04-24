import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { configureHeyApiClient } from "@/api/configureHeyApiClient";
import { AppStateProvider } from "@/context/AppStateContext";
import AppRoot from "@/App";

import "@/index.css";

dayjs.locale("zh-cn");
configureHeyApiClient();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN}>
      <App className="flex min-h-svh w-full min-w-0 flex-1 flex-col">
        <QueryClientProvider client={queryClient}>
          <AppStateProvider>
            <AppRoot />
          </AppStateProvider>
        </QueryClientProvider>
      </App>
    </ConfigProvider>
  </StrictMode>,
);
