/**
 * bangkokTime.ts — Date utilities anchored to Thailand timezone (GMT+7 / Asia/Bangkok).
 *
 * Thailand has NO daylight-saving time, so a fixed +7 h offset is safe and avoids
 * any dependency on the runtime's Intl timezone database completeness.
 *
 * Convention: `now?` parameter lets callers inject a fixed reference for unit tests.
 *   Pass `new Date('2026-06-24T00:00:00+07:00')` to freeze "today" deterministically.
 */

// ─── Internal helpers ─────────────────────────────────────────────────────────

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000; // 7 hours in milliseconds

/** Returns a Date object whose UTC fields represent Bangkok local time.
 *  e.g. if Bangkok date is 2026-06-24, d.getUTCFullYear()=2026, d.getUTCMonth()=5, d.getUTCDate()=24 */
function bangkokDate(now?: Date): Date {
  const utcMs = (now ?? new Date()).getTime();
  return new Date(utcMs + BKK_OFFSET_MS);
}

/** Returns today's date as YYYY-MM-DD in Bangkok local time. */
export function todayBangkokISO(now?: Date): string {
  const d = bangkokDate(now);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add `days` to a YYYY-MM-DD string (UTC-safe arithmetic). */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WeekRange {
  /** Inclusive start date YYYY-MM-DD (Bangkok) */
  startISO: string;
  /** Inclusive end date YYYY-MM-DD (Bangkok) */
  endISO: string;
}

/**
 * Returns the calendar date range for the given forecast week, anchored to
 * today in Bangkok time.
 *
 *   Week 1 = today + 0..+6   (1–7 day NWP forecast, Open-Meteo)
 *   Week 2 = today + 7..+13  (S2S lead-week 2)
 *   Week 3 = today + 14..+20 (S2S lead-week 3)
 *   Week 4 = today + 21..+27 (S2S lead-week 4)
 */
export function weekRange(week: 1 | 2 | 3 | 4, now?: Date): WeekRange {
  const today = todayBangkokISO(now);
  const offset = (week - 1) * 7;
  return {
    startISO: addDays(today, offset),
    endISO:   addDays(today, offset + 6),
  };
}

/**
 * Formats a WeekRange as a compact date-range string for display in the
 * week selector pill.
 *
 * Thai   → "24–30 มิ.ย."   (day range + Thai month abbreviation)
 * English→ "Jun 24–30"     (English month abbreviation + day range)
 *
 * If start and end are in different months the format is extended:
 * Thai   → "28 มิ.ย.–4 ก.ค."
 * English→ "Jun 28–Jul 4"
 */
export function formatWeekRange(week: 1 | 2 | 3 | 4, lang: 'th' | 'en' = 'th', now?: Date): string {
  const { startISO, endISO } = weekRange(week, now);

  const locale  = lang === 'th' ? 'th-TH' : 'en-US';
  const tzOpts  = { timeZone: 'Asia/Bangkok' } as const;

  const startDate = new Date(startISO + 'T00:00:00Z');
  const endDate   = new Date(endISO   + 'T00:00:00Z');

  const startDay = startDate.toLocaleDateString(locale, { ...tzOpts, day: 'numeric' });
  const endDay   = endDate.toLocaleDateString(locale,   { ...tzOpts, day: 'numeric' });
  const startMon = startDate.toLocaleDateString(locale, { ...tzOpts, month: 'short' });
  const endMon   = endDate.toLocaleDateString(locale,   { ...tzOpts, month: 'short' });

  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();

  if (lang === 'th') {
    return sameMonth
      ? `${startDay}–${endDay} ${startMon}`
      : `${startDay} ${startMon}–${endDay} ${endMon}`;
  } else {
    return sameMonth
      ? `${startMon} ${startDay}–${endDay}`
      : `${startMon} ${startDay}–${endMon} ${endDay}`;
  }
}

/**
 * Formats a UTC ISO timestamp for display in Bangkok time.
 * Uses short date + time (e.g. "24 มิ.ย. 13:45" / "Jun 24, 13:45").
 * Replaces the unzoned `formatGeneratedAt` in forecastService.ts.
 */
export function formatTimestampBangkok(iso: string | null | undefined, lang: 'th' | 'en' = 'th'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  return d.toLocaleString(locale, {
    timeZone: 'Asia/Bangkok',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
