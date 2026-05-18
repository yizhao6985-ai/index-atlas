import { shenwanPathDisplayChunks } from "@/lib/shenwanCascader";

type Props = {
  /** 存储路径（仅为申万三段 encode，不含「全部」哨兵）；空数组表示未筛选 */
  selectedPath: string[];
  onNavigatePrefix: (pathPrefix: string[]) => void;
  className?: string;
};

/**
 * 顶部级联的补充：用文字展示「第一档 全部／第二～四档对应申万一～三级」，并支持回溯点击。
 */
export default function ShenwanTierBreadcrumb({
  selectedPath,
  onNavigatePrefix,
  className = "",
}: Props) {
  const chunks = shenwanPathDisplayChunks(selectedPath);
  const hasFilter = chunks.length > 0;

  return (
    <nav
      aria-label="当前申万筛选层级"
      className={`box-border flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200/90 bg-white/95 px-3 py-1.5 text-[11px] leading-snug text-slate-600 sm:px-4 sm:text-xs ${className}`}
    >
      <span className="shrink-0 font-medium uppercase tracking-wide text-slate-400">申万层级</span>
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <ol className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 p-0 list-none">
        {!hasFilter ? (
          <li className="min-w-0">
            <span className="font-semibold text-slate-900" aria-current="page">
              第一层 · 全部（未按申万筛选）
            </span>
          </li>
        ) : (
          <>
            <li className="min-w-0 shrink-0">
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 text-left text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-900"
                onClick={() => onNavigatePrefix([])}
              >
                第一层 · 全部
              </button>
            </li>
            {chunks.map((chunk, i) => {
              const prefix = selectedPath.slice(0, chunk.tierIdx + 1);
              const last = i === chunks.length - 1;
              const tierCol = chunk.tierIdx + 2; // 第一层=全部已在上一 crumb；此为级联「第二～四列」
              return (
                <li key={`${chunk.tierIdx}:${chunk.label}`} className="flex min-w-0 items-center gap-x-2">
                  <span className="shrink-0 text-slate-300" aria-hidden>
                    ›
                  </span>
                  {!last ? (
                    <button
                      type="button"
                      className="min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-slate-600 underline decoration-dotted underline-offset-2 hover:text-slate-900"
                      onClick={() => onNavigatePrefix(prefix)}
                      title="回到该层级"
                    >
                      <span className="text-slate-400">{`${tierCol} 列 · `}</span>
                      {chunk.label}
                    </button>
                  ) : (
                    <span className="min-w-0 truncate font-semibold text-slate-900" aria-current="page">
                      <span className="font-normal text-slate-400">{`${tierCol} 列 · `}</span>
                      {chunk.label}
                    </span>
                  )}
                </li>
              );
            })}
          </>
        )}
      </ol>
    </nav>
  );
}
