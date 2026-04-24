/** 行情/快照时间：展示为北京时间、中文习惯（与 A 股场景一致） */
const DATA_AS_OF = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatDataAsOf(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return DATA_AS_OF.format(d);
}
