import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { getIndicesCatalog } from "@/api/generated/sdk.gen";
import type { IndicesResponse } from "@/api/generated/types.gen";

export type IndexCatalogHookValue = {
  indexCode: string;
  setIndexCode: (code: string) => void;
  indicesData: IndicesResponse | undefined;
};

/**
 * 指数目录：`GET /api/indices/catalog`，以及用 `defaultCode` 完成首次选中。
 */
export function useIndexCatalog(): IndexCatalogHookValue {
  const [indexCode, setIndexCode] = useState("000985.SH");
  const initializedFromDefaultRef = useRef(false);

  const { data: indicesData } = useQuery({
    queryKey: ["indices", "catalog"],
    queryFn: async () => {
      const res = await getIndicesCatalog();
      if (res.error) throw new Error(`indices ${JSON.stringify(res.error)}`);
      if (res.data === undefined) throw new Error("indices: empty body");
      return res.data;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    const d = indicesData?.defaultCode;
    if (d && !initializedFromDefaultRef.current) {
      setIndexCode(d);
      initializedFromDefaultRef.current = true;
    }
  }, [indicesData?.defaultCode]);

  return { indexCode, setIndexCode, indicesData };
}
