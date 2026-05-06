/**
 * 上海时区墙钟：与前端 `tradingSession`、worker `CN_TZ` 口径一致。
 */

export function shanghaiDateYYYYMMDD(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type ShanghaiSessionParts = {
  /** en-US weekday short: Sat / Sun / Mon … */
  weekdayShort: string;
  hour: number;
  minute: number;
};

export function getShanghaiSessionParts(now: Date = new Date()): ShanghaiSessionParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value;
  return {
    weekdayShort: pick("weekday") ?? "",
    hour: Number(pick("hour") ?? NaN),
    minute: Number(pick("minute") ?? NaN),
  };
}

/** 沪深连续竞价时段（不含集合竞价），与 worker `is_trading_session` 一致 */
export function isContinuousAuctionWallClock(hour: number, minute: number): boolean {
  const t = hour * 60 + minute;
  const open1 = 9 * 60 + 30;
  const close1 = 11 * 60 + 30;
  const open2 = 13 * 60;
  const close2 = 15 * 60;
  return (t >= open1 && t <= close1) || (t >= open2 && t <= close2);
}

export function isWeekendWeekdayShort(weekdayShort: string): boolean {
  return weekdayShort === "Sat" || weekdayShort === "Sun";
}
