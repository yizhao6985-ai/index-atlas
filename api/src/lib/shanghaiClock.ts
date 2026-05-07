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

/** 沪深连续竞价时段（不含集合竞价），与 worker `is_trading_session`、前端一致（分钟粒度，含两端整分） */
const OPEN_AM = 9 * 60 + 30;
const CLOSE_AM = 11 * 60 + 30;
const OPEN_PM = 13 * 60;
const CLOSE_PM = 15 * 60;

export function shanghaiMinuteOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** 下一轮状态切换瞬时（UTC）：上午段结束后、下午开始前、收盘后等非竞价起点 */
export function isContinuousAuctionWallClock(hour: number, minute: number): boolean {
  const t = shanghaiMinuteOfDay(hour, minute);
  return (t >= OPEN_AM && t <= CLOSE_AM) || (t >= OPEN_PM && t <= CLOSE_PM);
}

export function isWeekendWeekdayShort(weekdayShort: string): boolean {
  return weekdayShort === "Sat" || weekdayShort === "Sun";
}

/** 给定上海日期与墙钟时分秒，转成绝对时刻（中国与 UTC+8 等价） */
function shanghaiLocalToUtcInstant(ymd: string, hour: number, minute: number, second = 0): Date {
  const [y, mo, d] = ymd.split("-").map((x) => Number(x));
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(
    `${y}-${pad(mo)}-${pad(d)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`,
  );
}

function formatAsIsoUtc(d: Date): string {
  return d.toISOString();
}

/** 从「今日上海日」往后推日历日，用于日历表缺省时估算下一交易日（仅跳过周末）。 */
function addCalendarDaysShanghai(ymd: string, deltaDays: number): string {
  const noon = shanghaiLocalToUtcInstant(ymd, 12, 0, 0);
  const next = new Date(noon.getTime() + deltaDays * 86_400_000);
  return shanghaiDateYYYYMMDD(next);
}

function nextWeekdayYmdOnOrAfter(ymd: string): string {
  let cur = ymd;
  for (let i = 0; i < 14; i++) {
    const parts = getShanghaiSessionParts(shanghaiLocalToUtcInstant(cur, 12, 0, 0));
    if (!isWeekendWeekdayShort(parts.weekdayShort)) return cur;
    cur = addCalendarDaysShanghai(cur, 1);
  }
  return cur;
}

function nextWeekdayYmdStrictAfter(ymd: string): string {
  return nextWeekdayYmdOnOrAfter(addCalendarDaysShanghai(ymd, 1));
}

export type ContinuousAuctionSchedule = {
  continuousAuction: boolean;
  msUntilCurrentAuctionEnd: number | null;
  msUntilNextAuctionStart: number | null;
  /** 客户端应在此时间前后再次请求 `/api/session`（UTC ISO） */
  nextSessionBoundaryAt: string;
};

/**
 * 根据上海墙钟、当日是否 SSE 开市，计算连续竞价状态与下一 session 轮询锚点。
 * `nextOpenOnOrAfterToday` / `nextOpenStrictAfterToday` 来自 `trade_calendar`；缺省时「下一开市日」用「日历日 strictAfter + 跳过周末」近似（不含法定节假日）。
 */
export function computeContinuousAuctionSchedule(
  now: Date,
  shanghaiYmd: string,
  minuteOfDay: number,
  sseOpenDay: boolean,
  nextOpenOnOrAfterToday: string | null,
  nextOpenStrictAfterToday: string | null,
): ContinuousAuctionSchedule {
  const onOrAfter = nextOpenOnOrAfterToday ?? nextWeekdayYmdStrictAfter(shanghaiYmd);
  const strictAfter = nextOpenStrictAfterToday ?? nextWeekdayYmdStrictAfter(shanghaiYmd);

  const inWallClock = isContinuousAuctionWallClock(
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
  );
  const continuousAuction = sseOpenDay && inWallClock;
  const t = now.getTime();

  const msTo = (instant: Date) => Math.max(0, instant.getTime() - t);

  // 非交易日：下一锚点 = 下一开市日 09:30
  if (!sseOpenDay) {
    const openAt = shanghaiLocalToUtcInstant(onOrAfter, 9, 30, 0);
    return {
      continuousAuction: false,
      msUntilCurrentAuctionEnd: null,
      msUntilNextAuctionStart: msTo(openAt),
      nextSessionBoundaryAt: formatAsIsoUtc(openAt),
    };
  }

  // 交易日、上午连续竞价
  if (minuteOfDay >= OPEN_AM && minuteOfDay <= CLOSE_AM) {
    const endAm = shanghaiLocalToUtcInstant(shanghaiYmd, 11, 31, 0);
    return {
      continuousAuction: true,
      msUntilCurrentAuctionEnd: msTo(endAm),
      msUntilNextAuctionStart: null,
      nextSessionBoundaryAt: formatAsIsoUtc(endAm),
    };
  }

  // 交易日、下午连续竞价
  if (minuteOfDay >= OPEN_PM && minuteOfDay <= CLOSE_PM) {
    const endPm = shanghaiLocalToUtcInstant(shanghaiYmd, 15, 1, 0);
    return {
      continuousAuction: true,
      msUntilCurrentAuctionEnd: msTo(endPm),
      msUntilNextAuctionStart: null,
      nextSessionBoundaryAt: formatAsIsoUtc(endPm),
    };
  }

  // 交易日、盘前
  if (minuteOfDay < OPEN_AM) {
    const openAt = shanghaiLocalToUtcInstant(shanghaiYmd, 9, 30, 0);
    return {
      continuousAuction: false,
      msUntilCurrentAuctionEnd: null,
      msUntilNextAuctionStart: msTo(openAt),
      nextSessionBoundaryAt: formatAsIsoUtc(openAt),
    };
  }

  // 交易日、午休
  if (minuteOfDay > CLOSE_AM && minuteOfDay < OPEN_PM) {
    const openPm = shanghaiLocalToUtcInstant(shanghaiYmd, 13, 0, 0);
    return {
      continuousAuction: false,
      msUntilCurrentAuctionEnd: null,
      msUntilNextAuctionStart: msTo(openPm),
      nextSessionBoundaryAt: formatAsIsoUtc(openPm),
    };
  }

  // 交易日、已收盘
  const nextDayOpen = shanghaiLocalToUtcInstant(strictAfter, 9, 30, 0);
  return {
    continuousAuction: false,
    msUntilCurrentAuctionEnd: null,
    msUntilNextAuctionStart: msTo(nextDayOpen),
    nextSessionBoundaryAt: formatAsIsoUtc(nextDayOpen),
  };
}
