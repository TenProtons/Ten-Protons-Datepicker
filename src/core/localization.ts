import { makeDate } from './Day';
import type { LocaleObject, LocaleStrings } from './types';

export interface Locale {
  code: string;
  rtl: boolean;
  /** 0 = Sunday. */
  firstDay: number;
  strings: LocaleStrings;
  /** Default numeric token format derived from the locale, e.g. `dd.MM.yyyy`. */
  format: string;
  /** "March 2025" */
  title(d: Date): string;
  /** "Wednesday, March 5, 2025" */
  label(d: Date): string;
  /** Weekday name; `i` = 0 for Sunday. */
  dow(i: number, long?: boolean): string;
  /** Month name as used inside a date (genitive in e.g. Ukrainian). */
  month(i: number, short?: boolean): string;
  /** Month index for a parsed name (any form), or -1. */
  monthIndex(name: string): number;
  /** Day number in the locale's digits. */
  num(n: number): string;
}

const EN: LocaleStrings = {
  today: 'Today',
  clear: 'Clear',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  label: 'Choose date',
  selected: 'Selected',
};

// Always the Gregorian calendar, so `ar-SA` / `th-TH` don't silently switch calendar systems.
const BASE: Intl.DateTimeFormatOptions = { calendar: 'gregory' };
const registry = new Map<string, LocaleObject>();

/** Makes a locale available by tag, e.g. for `<x-datepicker locale="uk">`. */
export const registerLocale = (locale: LocaleObject): void => {
  registry.set(locale.code.toLowerCase(), locale);
};

const memo = <T>(fn: () => T): (() => T) => {
  let v: T | undefined;
  return () => (v ??= fn());
};
const norm = (s: string): string => s.toLowerCase().replace(/\./g, '');
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

// Fallbacks for engines without Intl.Locale#getWeekInfo / #getTextInfo.
const SUNDAY_REGIONS = /^(US|CA|MX|BR|JP|IL|IN|PH|KR|TW|HK|ZA|SA)$/;
const RTL_LANGS = /^(ar|he|iw|fa|ur|ps|sd|ug|yi|dv|ckb)(-|$)/i;

const autoToday = (code: string): string => {
  try {
    const t = new Intl.RelativeTimeFormat(code, { numeric: 'auto' }).format(0, 'day');
    return t.charAt(0).toLocaleUpperCase(code) + t.slice(1);
  } catch {
    return EN.today;
  }
};

export const resolveLocale = (input?: string | LocaleObject, firstDayOverride?: number): Locale => {
  const tag = typeof input === 'string' ? input : input?.code;
  let code = tag || (typeof navigator !== 'undefined' && navigator.language) || 'en';
  try {
    new Intl.DateTimeFormat(code);
  } catch {
    code = 'en';
  }
  const lower = code.toLowerCase();
  const custom: LocaleObject | undefined =
    typeof input === 'object' ? input : (registry.get(lower) ?? registry.get(lower.split('-')[0]!));

  const strings: LocaleStrings = { ...EN, today: autoToday(code) };
  for (const k of Object.keys(EN) as Array<keyof LocaleStrings>) {
    const v = custom?.[k];
    if (v) strings[k] = v;
  }

  const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(code, { ...BASE, ...o });
  const intl = new Intl.Locale(code) as Intl.Locale & {
    getWeekInfo?(): { firstDay: number };
    weekInfo?: { firstDay: number };
    getTextInfo?(): { direction: string };
    textInfo?: { direction: string };
  };
  const week = intl.getWeekInfo?.() ?? intl.weekInfo;
  const dir = (intl.getTextInfo?.() ?? intl.textInfo)?.direction;
  const region = intl.maximize().region ?? '';

  const titleF = dtf({ month: 'long', year: 'numeric' });
  const labelF = dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const nf = new Intl.NumberFormat(code);
  const nums: string[] = [];

  const names = (month: 'long' | 'short', withDay: boolean) =>
    range(12).map((i) => {
      const d = makeDate(2000, i, 1);
      if (!withDay) return dtf({ month }).format(d);
      return dtf({ day: 'numeric', month }).formatToParts(d).find((p) => p.type === 'month')!.value;
    });
  const inDate = { long: memo(() => names('long', true)), short: memo(() => names('short', true)) };
  const alone = { long: memo(() => names('long', false)), short: memo(() => names('short', false)) };
  const weekdays = { long: memo(() => range(7).map((i) => dtf({ weekday: 'long' }).format(makeDate(2000, 0, 2 + i)))), short: memo(() => range(7).map((i) => dtf({ weekday: 'short' }).format(makeDate(2000, 0, 2 + i)))) };
  const lookup = memo(() => {
    const map = new Map<string, number>();
    const all = [inDate.long(), inDate.short(), alone.long(), alone.short(), custom?.months, custom?.monthsShort];
    for (const list of all) list?.forEach((n, i) => map.set(norm(n), i));
    return map;
  });

  const month = (i: number, short = false): string =>
    (short ? (custom?.monthsShort ?? custom?.months) : custom?.months)?.[i] ?? inDate[short ? 'short' : 'long']()[i]!;
  const dow = (i: number, long = false): string =>
    (long ? custom?.weekdays : (custom?.weekdaysShort ?? custom?.weekdays))?.[i] ?? weekdays[long ? 'long' : 'short']()[i]!;

  const format = memo(() =>
    dtf({ numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(makeDate(2000, 10, 22))
      .map((p) => (p.type === 'year' ? 'yyyy' : p.type === 'month' ? 'MM' : p.type === 'day' ? 'dd' : p.value.replace(/[‎‏؜]/g, '')))
      .join(''),
  );

  return {
    code,
    rtl: custom?.rtl ?? (dir ? dir === 'rtl' : RTL_LANGS.test(code)),
    firstDay: firstDayOverride ?? custom?.firstDayOfWeek ?? (week?.firstDay ?? (SUNDAY_REGIONS.test(region) ? 7 : 1)) % 7,
    strings,
    get format() {
      return format();
    },
    title: (d) => (custom?.months ? `${custom.months[d.getMonth()]} ${d.getFullYear()}` : titleF.format(d)),
    label: (d) =>
      custom?.months || custom?.weekdays
        ? `${dow(d.getDay(), true)}, ${d.getDate()} ${month(d.getMonth())} ${d.getFullYear()}`
        : labelF.format(d),
    dow,
    month,
    monthIndex: (name) => lookup().get(norm(name)) ?? -1,
    num: (n) => (nums[n] ??= nf.format(n)),
  };
};
