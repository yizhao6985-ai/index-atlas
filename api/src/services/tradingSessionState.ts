import type pg from "pg";

import {
  getShanghaiSessionParts,
  isContinuousAuctionWallClock,
  isWeekendWeekdayShort,
  shanghaiDateYYYYMMDD,
} from "../lib/shanghaiClock.js";

const SSE = "SSE";

export type TradingSessionPayload = {
  /** 与 worker `job_rt_k` 一致：SSE 日历当日开市 + 连续竞价墙钟 */
  continuousAuction: boolean;
  sseOpenDay: boolean;
  /** 是否在库内命中 `trade_calendar`（未命中时 `sseOpenDay` 退回为「非周末」近似） */
  tradeCalendarHit: boolean;
  shanghaiDate: string;
};

export async function getTradingSessionState(
  pool: pg.Pool,
  now: Date = new Date(),
): Promise<TradingSessionPayload> {
  const shanghaiDate = shanghaiDateYYYYMMDD(now);
  const clock = getShanghaiSessionParts(now);
  const inAuction = isContinuousAuctionWallClock(clock.hour, clock.minute);

  const r = await pool.query<{ is_open: number }>(
    `SELECT is_open
     FROM trade_calendar
     WHERE exchange = $1 AND cal_date = $2::date
     LIMIT 1`,
    [SSE, shanghaiDate],
  );

  let tradeCalendarHit = false;
  let sseOpenDay = false;

  if (r.rows.length > 0) {
    tradeCalendarHit = true;
    sseOpenDay = Number(r.rows[0].is_open) === 1;
  } else {
    sseOpenDay = !isWeekendWeekdayShort(clock.weekdayShort);
  }

  return {
    continuousAuction: sseOpenDay && inAuction,
    sseOpenDay,
    tradeCalendarHit,
    shanghaiDate,
  };
}
