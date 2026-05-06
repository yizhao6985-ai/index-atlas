import { useQuery } from "@tanstack/react-query";

import { getMarketSnapshot, getMarketSnapshotRt } from "@/api/generated/sdk.gen";
import { useAppState } from "@/context/AppStateContext";

/**
 * 连续竞价：rt_k 路径（约 10s 刷新）；非连续竞价：1d 预计算 rollup（晚盘由 quotes_daily 重算，「数据截至」为入库/rollup 时间，而非盘中 rt 残留）。
 */
export function useMarketSnapshotQuery() {
  const { indexCode, metric, isTrading } = useAppState();

  return useQuery({
    queryKey: ["market", isTrading ? "rt" : "1d", indexCode, metric],
    queryFn: async () => {
      if (isTrading) {
        const res = await getMarketSnapshotRt({
          path: { code: indexCode },
          query: { sortBy: metric },
        });
        if (res.error) throw new Error(`market/rt ${JSON.stringify(res.error)}`);
        if (res.data === undefined) throw new Error("market/rt: empty body");
        return res.data;
      }
      const res = await getMarketSnapshot({
        path: { code: indexCode },
        query: { window: "1d", sortBy: metric },
      });
      if (res.error) throw new Error(`market ${JSON.stringify(res.error)}`);
      if (res.data === undefined) throw new Error("market: empty body");
      return res.data;
    },
    refetchInterval: () => (isTrading ? 10_000 : false),
  });
}
