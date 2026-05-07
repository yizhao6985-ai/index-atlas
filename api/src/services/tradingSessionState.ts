import type pg from "pg";

import {
  computeContinuousAuctionSchedule,
  getShanghaiSessionParts,
  isWeekendWeekdayShort,
  shanghaiDateYYYYMMDD,
  shanghaiMinuteOfDay,
  type ContinuousAuctionSchedule,
} from "../lib/shanghaiClock.js";

const SSE = "SSE";

export type TradingSessionPayload = ContinuousAuctionSchedule;

async function fetchNextOpenOnOrAfter(
  pool: pg.Pool,
  fromYmd: string,
): Promise<string | null> {
  const r = await pool.query<{ d: string }>(
    `SELECT cal_date::text AS d
     FROM trade_calendar
     WHERE exchange = $1 AND is_open = 1 AND cal_date >= $2::date
     ORDER BY cal_date ASC
     LIMIT 1`,
    [SSE, fromYmd],
  );
  return r.rows[0]?.d ?? null;
}

async function fetchNextOpenStrictAfter(
  pool: pg.Pool,
  afterYmd: string,
): Promise<string | null> {
  const r = await pool.query<{ d: string }>(
    `SELECT cal_date::text AS d
     FROM trade_calendar
     WHERE exchange = $1 AND is_open = 1 AND cal_date > $2::date
     ORDER BY cal_date ASC
     LIMIT 1`,
    [SSE, afterYmd],
  );
  return r.rows[0]?.d ?? null;
}

export async function getTradingSessionState(
  pool: pg.Pool,
  now: Date = new Date(),
): Promise<TradingSessionPayload> {
  const shanghaiDate = shanghaiDateYYYYMMDD(now);
  const clock = getShanghaiSessionParts(now);
  const minuteOfDay = shanghaiMinuteOfDay(clock.hour, clock.minute);

  const todayCal = await pool.query<{ is_open: number }>(
    `SELECT is_open
     FROM trade_calendar
     WHERE exchange = $1 AND cal_date = $2::date
     LIMIT 1`,
    [SSE, shanghaiDate],
  );

  let sseOpenDay = false;

  if (todayCal.rows.length > 0) {
    sseOpenDay = Number(todayCal.rows[0].is_open) === 1;
  } else {
    sseOpenDay = !isWeekendWeekdayShort(clock.weekdayShort);
  }

  const [nextOnOrAfter, nextStrictAfter] = await Promise.all([
    fetchNextOpenOnOrAfter(pool, shanghaiDate),
    fetchNextOpenStrictAfter(pool, shanghaiDate),
  ]);

  return computeContinuousAuctionSchedule(
    now,
    shanghaiDate,
    minuteOfDay,
    sseOpenDay,
    nextOnOrAfter,
    nextStrictAfter,
  );
}
