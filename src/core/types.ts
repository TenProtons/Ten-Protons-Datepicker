import type { Datepicker } from './Datepicker';

/** Day of week, `0` = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DatepickerMode = 'single' | 'range' | 'multiple';
export type Position = 'auto' | 'top' | 'bottom' | 'left' | 'right';

/** `Date` in single mode, `Date[]` in range/multiple mode, `null` when nothing is selected. */
export type DatepickerValue = Date | Date[] | null;

/** UI strings. Defaults are English; `today` is localised through `Intl.RelativeTimeFormat`. */
export interface LocaleStrings {
  today: string;
  clear: string;
  prevMonth: string;
  nextMonth: string;
  /** Accessible name of the calendar dialog. */
  label: string;
  /** Prefix of the screen-reader announcement, e.g. "Selected: Wednesday, March 5, 2025". */
  selected: string;
}

/** Override only what you need; everything else comes from `Intl` for `code`. */
export interface LocaleObject extends Partial<LocaleStrings> {
  /** BCP 47 tag, e.g. `uk`, `en-GB`. */
  code: string;
  firstDayOfWeek?: Weekday;
  rtl?: boolean;
  /** 12 month names, January first. */
  months?: string[];
  monthsShort?: string[];
  /** 7 weekday names, Sunday first. */
  weekdays?: string[];
  weekdaysShort?: string[];
}

/** CSS classes used by the calendar. Replace any of them to fully restyle (Tailwind, CSS Modules...). */
export interface ClassNames {
  root: string;
  /** Added to the root when the calendar is a popup (not inline). */
  pop: string;
  months: string;
  head: string;
  title: string;
  nav: string;
  grid: string;
  dow: string;
  day: string;
  out: string;
  today: string;
  selected: string;
  disabled: string;
  inRange: string;
  rangeStart: string;
  rangeEnd: string;
  foot: string;
  btn: string;
  /** Visually hidden (screen-reader only) text. */
  sr: string;
}

export interface DatepickerOptions {
  /** `'single'` (default). `'range'` / `'multiple'` require importing their module first. */
  mode?: DatepickerMode;

  /** Initial / new selection. Takes precedence over the input's existing value. */
  selected?: Date | Date[] | null;
  /** Month shown (and day focused) when nothing is selected. Defaults to today. */
  defaultDate?: Date | null;

  /** `Date` or ISO `yyyy-MM-dd` string. */
  minDate?: Date | string | null;
  maxDate?: Date | string | null;
  disabledDates?: Date[] | ((date: Date) => boolean);
  /** `0` = Sunday. */
  disabledDaysOfWeek?: number[];

  /** BCP 47 tag, or a `LocaleObject` with overrides. */
  locale?: string | LocaleObject;
  firstDayOfWeek?: Weekday;
  /**
   * Token format used for display and manual input. Tokens: `yyyy yy MMMM MMM MM M dd d EEEE EEE`;
   * quote literals with `'...'`. Defaults to the locale's numeric order (`dd.MM.yyyy` for `uk`).
   */
  dateFormat?: string;

  /** Render the calendar permanently instead of as a popup. Read at construction only. */
  inline?: boolean;
  showOtherMonths?: boolean;
  numberOfMonths?: 1 | 2;
  position?: Position;
  /** Force `light` / `dark`. Omit to follow `prefers-color-scheme`. */
  theme?: 'light' | 'dark';

  /** Allow typing a date. Default `true`. When `false` the input is read-only. */
  allowInput?: boolean;
  /** Close once a selection is complete. Defaults to `true` for single/range, `false` for multiple. */
  closeOnSelect?: boolean;
  closeOnOutsideClick?: boolean;

  /** Replace default CSS class names. */
  classes?: Partial<ClassNames>;
  /** Input that receives the ISO value (`yyyy-MM-dd`, ranges as `a/b`, multiple as `a,b`). */
  isoInput?: HTMLInputElement | null;
  /** Element the popup is positioned against and treated as "inside" for outside clicks. Read at construction. */
  anchor?: HTMLElement;
  /** Where the popup is appended. Defaults to `document.body`. Read at construction. */
  appendTo?: ParentNode;

  onChange?: (dates: DatepickerValue, instance: Datepicker) => void;
  onOpen?: (instance: Datepicker) => void;
  onClose?: (instance: Datepicker) => void;
  onMonthChange?: (date: Date, instance: Datepicker) => void;
}

export interface DatepickerEventMap {
  change: CustomEvent<DatepickerValue>;
  open: CustomEvent<undefined>;
  close: CustomEvent<undefined>;
  monthChange: CustomEvent<Date>;
  yearChange: CustomEvent<Date>;
}
