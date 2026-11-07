import { makeDate } from './Day';
import type { Locale } from './localization';
import type { Time } from './time';

// 1: quoted literal, 2: token, 3: any other literal run
const TOKEN = /'([^']*)'|(yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE)|([^'yMdE]+|.)/g;
const ALNUM = /[\p{L}\p{N}]/u;
const TIME = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
const pad = (n: number, len = 2): string => String(n).padStart(len, '0');

/** `HH:mm:ss` (24-hour). With `enableTime` it follows the date, whatever `dateFormat` is. */
export const formatTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export const formatDate = (d: Date, fmt: string, loc: Locale): string =>
  fmt.replace(TOKEN, (_: string, quoted?: string, token?: string, literal?: string) => {
    if (!token) return quoted ?? literal ?? '';
    const [y, m, day] = [d.getFullYear(), d.getMonth(), d.getDate()];
    switch (token) {
      case 'yyyy': return pad(y, 4);
      case 'yy': return pad(y % 100);
      case 'MMMM': return loc.month(m);
      case 'MMM': return loc.month(m, true);
      case 'MM': return pad(m + 1);
      case 'M': return String(m + 1);
      case 'dd': return pad(day);
      case 'd': return String(day);
      default: return loc.dow(d.getDay(), token === 'EEEE');
    }
  });

/**
 * Finds every date written in `fmt` inside `text` ("05.03.2025 – 10.03.2025" gives two).
 * Separators are matched leniently. Returns `null` for invalid dates (31.02), unknown month
 * names, or any leftover text that isn't a separator.
 *
 * With `time` (the picker's current time of day) each date may be followed by `HH:mm[:ss]`
 * ("05.03.2025 13:07:09"); dates written without a time get `time`. Without it, times are invalid text.
 */
export const parseDates = (text: string, fmt: string, loc: Locale, time?: Time): Date[] | null => {
  const order: string[] = [];
  let src = '';
  for (const [, quoted, token, literal] of fmt.matchAll(TOKEN)) {
    if (!token) {
      const s = quoted ?? literal ?? '';
      src += ALNUM.test(s) ? `\\s*(?:${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})?\\s*` : '[^\\p{L}\\p{N}]*';
    } else if (token[0] === 'E') {
      src += '(?:\\p{L}+\\.?[^\\p{L}\\p{N}]+)?'; // weekday names are optional and ignored; the separator stops "Mar" matching as "Ma" + "r"
    } else {
      order.push(token);
      src += token === 'yyyy' ? '(\\d{4})' : token === 'yy' ? '(\\d{2})' : token.length > 2 ? '(\\p{L}+\\.?)' : '(\\d{1,2})';
    }
  }

  // Arabic-Indic / Persian digits to ASCII (their code points end in the digit's value).
  let s = text.replace(/[٠-٩۰-۹]/g, (c) => String(c.charCodeAt(0) & 15));
  // Times are lifted out first so the date pattern never sees them; the i-th time belongs to the i-th date.
  const times: Time[] = [];
  if (time) s = s.replace(TIME, (_, h: string, m: string, sec?: string) => (times.push([+h, +m, +(sec ?? 0)]), ' '));
  const now = new Date();
  const out: Date[] = [];
  let rest = '';
  let last = 0;

  for (const m of s.matchAll(new RegExp(src, 'gu'))) {
    let [y, mo, d] = [now.getFullYear(), now.getMonth(), 1];
    order.forEach((token, i) => {
      const g = m[i + 1]!;
      if (token === 'yyyy') y = +g;
      else if (token === 'yy') y = 2000 + +g > now.getFullYear() + 50 ? 1900 + +g : 2000 + +g;
      else if (token[0] === 'd') d = +g;
      else mo = token.length > 2 ? loc.monthIndex(g) : +g - 1;
    });
    const date = makeDate(y, mo, d);
    if (mo < 0 || date.getMonth() !== mo || date.getDate() !== d) return null;
    if (time) {
      const t = times.length ? times[out.length] : time;
      if (!t || t[0] > 23 || t[1] > 59 || t[2] > 59) return null;
      date.setHours(...t);
    }
    out.push(date);
    rest += s.slice(last, m.index);
    last = m.index! + m[0].length;
  }
  rest += s.slice(last);
  return out.length && !ALNUM.test(rest) && (!times.length || times.length === out.length) ? out : null;
};
