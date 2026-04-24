/**
 * Browser-side session check (Asia/Shanghai).
 * Weekends off; **does not** exclude CN public holidays (learning project; worker uses chinese-calendar).
 */
export function isTradingSessionSimple(): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value;
  if (wd === "Sat" || wd === "Sun") return false;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  const t = hour * 60 + minute;
  const open1 = 9 * 60 + 30;
  const close1 = 11 * 60 + 30;
  const open2 = 13 * 60;
  const close2 = 15 * 60;
  return (t >= open1 && t <= close1) || (t >= open2 && t <= close2);
}
