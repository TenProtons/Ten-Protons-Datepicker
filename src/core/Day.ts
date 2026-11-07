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

/** `yyyy-MM-dd` in local time (never `toISOString`, which shifts the day across time zones). */
export const formatISO = (d: Date): string => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const mo = +m[2]! - 1;
  const d = makeDate(+m[1]!, mo, +m[3]!);
  return d.getMonth() === mo && d.getDate() === +m[3]! ? d : null;
};

/** Local day of a Unix timestamp in seconds. */
const fromUnix = (seconds: number): Date | null => {
  const d = new Date(seconds * 1000);
  return isNaN(+d) ? null : startOfDay(d);
};

/** Unix timestamp (seconds) of the local midnight of `d`. */
export const toUnix = (d: Date): number => d.getTime() / 1000;

/** Digits only, 9-11 of them (years 1973-5138), so no date format can be mistaken for a timestamp. */
export const parseUnix = (s: string): Date | null => (/^\d{9,11}$/.test(s.trim()) ? fromUnix(+s) : null);

const VALUE = /\d{4}-\d{2}-\d{2}|\d{9,11}/g;

/**
 * Parses ISO dates and/or Unix timestamps separated by whitespace, `,` `;` `/` or dashes:
 * `2025-03-05`, `1741996800`, `2025-03-01/2025-03-10`, `1741996800 - 1742428800`.
 * `null` if anything else is in the text.
 */
export const parseValueList = (s: string): Date[] | null => {
  const dates = (s.match(VALUE) ?? []).map((p) => parseISO(p) ?? parseUnix(p));
  return dates.every((d): d is Date => d !== null) && !s.replace(VALUE, '').replace(/[\s,;/–—-]/g, '') ? (dates as Date[]) : null;
};

/** Normalises a `Date`, ISO string, Unix timestamp (number or digit string, in seconds) to a local midnight; anything else becomes `null`. */
export const toDate = (v: unknown): Date | null => {
  const d = v instanceof Date ? v : typeof v === 'string' ? (parseISO(v) ?? parseUnix(v)) : typeof v === 'number' ? fromUnix(v) : null;
  return d && !isNaN(+d) ? startOfDay(d) : null;
};
