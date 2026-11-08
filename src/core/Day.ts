/**
 * Date helpers. Every date the library creates is a local-time midnight, and days are
 * compared through `dayKey` (never by timestamp), so DST shifts can't skew comparisons.
 */

/** Local midnight of y-m-d. Month/day may overflow. `setFullYear` keeps years < 100 intact. */
export const makeDate = (y: number, m: number, d: number): Date => {
  const x = new Date(2000, 0, 1);
  x.setFullYear(y, m, d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const startOfDay = (d: Date): Date => makeDate(d.getFullYear(), d.getMonth(), d.getDate());
export const monthStart = (d: Date): Date => makeDate(d.getFullYear(), d.getMonth(), 1);
export const addDays = (d: Date, n: number): Date => makeDate(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Adds months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export const addMonths = (d: Date, n: number): Date => {
  const t = makeDate(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(d.getDate(), makeDate(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return t;
};

/** Sortable integer identity of a calendar day (yyyymmdd with a 0-based month). */
export const dayKey = (d: Date): number => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
export const fromKey = (k: number): Date => makeDate(Math.floor(k / 10000), Math.floor(k / 100) % 100, k % 100);

const pad = (n: number, len = 2): string => String(n).padStart(len, '0');

/** UTC counterpart of `makeDate` (also safe for years < 100). */
const utcDate = (y: number, m: number, d: number, h = 0, mi = 0, s = 0): Date => {
  const x = new Date(0);
  x.setUTCFullYear(y, m, d);
  x.setUTCHours(h, mi, s, 0);
  return x;
};

/**
 * Inside the picker a date is a local calendar day, or with `time` a local wall-clock time. Values crossing the
 * API (`selected`, `getDate()`, ISO strings, timestamps...) are instants, and with `utc` (`valueInUtc`) a plain day
 * is its UTC day (UTC midnight). These two functions are the only place the two meet.
 */
const fromInstant = (d: Date, time: boolean, utc: boolean): Date =>
  utc && !time ? makeDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : normDate(d, time);

/** The value reported for a picker date: the same instant, or with `utc` and no time, UTC midnight of its day. */
export const toInstant = (d: Date, time = false, utc = false): Date =>
  utc && !time ? utcDate(d.getFullYear(), d.getMonth(), d.getDate()) : new Date(d);

/** Unix timestamp (seconds) of `toInstant`: the local midnight / selected time, or with `utc` and no time, UTC midnight. */
export const toUnix = (d: Date, time = false, utc = false): number => Math.floor(toInstant(d, time, utc).getTime() / 1000);

/**
 * `yyyy-MM-dd` (never `toISOString`, which shifts the day across time zones). With `time`: `yyyy-MM-ddTHH:mm:ss`
 * in local time, or with `utc` as the UTC instant: `yyyy-MM-ddTHH:mm:ssZ`.
 */
export const formatISO = (d: Date, time = false, utc = false): string => {
  const u = time && utc;
  const [y, mo, day, h, mi, s] = u
    ? [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    : [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
  return `${pad(y!, 4)}-${pad(mo! + 1)}-${pad(day!)}${time ? `T${pad(h!)}:${pad(mi!)}:${pad(s!)}${u ? 'Z' : ''}` : ''}`;
};

// yyyy-MM-dd, optionally T/space + HH:mm[:ss[.fff]] and a zone (Z, +02:00, -0300)
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Parses an ISO date or date-time into a picker date. A date-time without a zone is local time, or UTC with `utc`;
 * a zone (`Z`, `+02:00`) always wins. A bare `yyyy-MM-dd` names a calendar day, so no zone applies to it
 * (unless a time picker reads it as UTC midnight).
 */
export const parseISO = (s: string, time = false, utc = false): Date | null => {
  const m = ISO.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1]!, +m[2]! - 1, +m[3]!];
  const [h, mi, sec] = [+(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)];
  const day = makeDate(y, mo, d);
  if (day.getMonth() !== mo || day.getDate() !== d || h > 23 || mi > 59 || sec > 59) return null;
  if (m[4] === undefined && !(time && utc)) return day;

  const zone = m[7];
  let at: Date;
  if (zone && zone !== 'Z') {
    const offset = (zone[0] === '-' ? -1 : 1) * (+zone.slice(1, 3) * 60 + +zone.slice(-2));
    at = new Date(utcDate(y, mo, d, h, mi, sec).getTime() - offset * 60000);
  } else if (zone || utc) at = utcDate(y, mo, d, h, mi, sec);
  else (at = day).setHours(h, mi, sec);
  return fromInstant(at, time, utc);
};

/** The picker date of a Unix timestamp in seconds. */
const fromUnix = (seconds: number, time: boolean, utc: boolean): Date | null => {
  const d = new Date(seconds * 1000);
  return isNaN(+d) ? null : fromInstant(d, time, utc);
};

/** Digits only, 9-11 of them (years 1973-5138), so no date format can be mistaken for a timestamp. */
export const parseUnix = (s: string, time = false, utc = false): Date | null =>
  /^\d{9,11}$/.test(s.trim()) ? fromUnix(+s, time, utc) : null;

const VALUE = /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?|\d{9,11}/g;

/**
 * Parses ISO dates (with an optional time and zone) and/or Unix timestamps separated by whitespace, `,` `;` `/` or dashes:
 * `2025-03-05`, `2025-03-05T13:07:09Z`, `1741996800`, `2025-03-01/2025-03-10`, `1741996800 - 1742428800`.
 * Returns picker dates (see `parseISO` for `time` / `utc`). `null` if anything else is in the text.
 */
export const parseValueList = (s: string, time = false, utc = false): Date[] | null => {
  const dates = (s.match(VALUE) ?? []).map((p) => parseISO(p, time, utc) ?? parseUnix(p, time, utc));
  return dates.every((d): d is Date => d !== null) && !s.replace(VALUE, '').replace(/[\s,;/–—-]/g, '') ? (dates as Date[]) : null;
};

/** A copy of `d` as the picker stores it: local midnight, or with `time` the time of day to the second. */
export const normDate = (d: Date, time = false): Date => {
  if (!time) return startOfDay(d);
  const x = new Date(d);
  x.setMilliseconds(0);
  return x;
};

/**
 * Turns a `Date`, ISO string or Unix timestamp (number or digit string, in seconds) into a picker date;
 * anything else becomes `null`. `time` keeps the time of day; `utc` reads the value as UTC (see `fromInstant`).
 */
export const toDate = (v: unknown, time = false, utc = false): Date | null => {
  const d = v instanceof Date ? fromInstant(v, time, utc) : typeof v === 'string' ? (parseISO(v, time, utc) ?? parseUnix(v, time, utc)) : typeof v === 'number' ? fromUnix(v, time, utc) : null;
  return d && !isNaN(+d) ? d : null;
};
