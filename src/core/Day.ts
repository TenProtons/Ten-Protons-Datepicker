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

/**
 * `yyyy-MM-dd` in local time (never `toISOString`, which shifts the day across time zones),
 * or `yyyy-MM-ddTHH:mm:ss` (local, no zone suffix) with `time`.
 */
export const formatISO = (d: Date, time = false): string =>
  `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}${time ? `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : ''}`;

/** `yyyy-MM-dd`, optionally followed by `THH:mm[:ss]` (or a space instead of the `T`). Without a time part: local midnight. */
export const parseISO = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s.trim());
  if (!m) return null;
  const mo = +m[2]! - 1;
  const [h, mi, sec] = [+(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)];
  const d = makeDate(+m[1]!, mo, +m[3]!);
  d.setHours(h, mi, sec);
  return d.getMonth() === mo && d.getDate() === +m[3]! && h < 24 && mi < 60 && sec < 60 ? d : null;
};

/** The instant of a Unix timestamp in seconds. */
const fromUnix = (seconds: number): Date | null => {
  const d = new Date(seconds * 1000);
  return isNaN(+d) ? null : d;
};

/** Unix timestamp (seconds) of `d`: its local midnight for a plain date, or the selected time of day. */
export const toUnix = (d: Date): number => Math.floor(d.getTime() / 1000);

/** Digits only, 9-11 of them (years 1973-5138), so no date format can be mistaken for a timestamp. */
export const parseUnix = (s: string): Date | null => (/^\d{9,11}$/.test(s.trim()) ? fromUnix(+s) : null);

const VALUE = /\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?|\d{9,11}/g;

/**
 * Parses ISO dates (with an optional time) and/or Unix timestamps separated by whitespace, `,` `;` `/` or dashes:
 * `2025-03-05`, `2025-03-05T13:07:09`, `1741996800`, `2025-03-01/2025-03-10`, `1741996800 - 1742428800`.
 * The dates keep their time; use `normDate` to apply the picker's mode. `null` if anything else is in the text.
 */
export const parseValueList = (s: string): Date[] | null => {
  const dates = (s.match(VALUE) ?? []).map((p) => parseISO(p) ?? parseUnix(p));
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
 * Normalises a `Date`, ISO string or Unix timestamp (number or digit string, in seconds) with `normDate`;
 * anything else becomes `null`.
 */
export const toDate = (v: unknown, time = false): Date | null => {
  const d = v instanceof Date ? v : typeof v === 'string' ? (parseISO(v) ?? parseUnix(v)) : typeof v === 'number' ? fromUnix(v) : null;
  return d && !isNaN(+d) ? normDate(d, time) : null;
};
