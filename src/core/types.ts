import type { Datepicker } from './Datepicker';

/** Day of week, `0` = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DatepickerMode = 'single' | 'range' | 'multiple';
export type Position = 'auto' | 'top' | 'bottom' | 'left' | 'right';

/**
 * What the picker reports: `Date` in single mode, `Date[]` in range/multiple mode, `null` when nothing is
 * selected. With `outputTimestamp` the dates are Unix timestamps in seconds (`number` / `number[]`).
 */
export type DatepickerValue = Date | Date[] | number | number[] | null;

/** What the picker accepts: a `Date`, an ISO `yyyy-MM-dd` string, or a Unix timestamp in seconds (number or digit string). */
export type DateInput = Date | string | number;

/** UI strings. Defaults are English; `today` is localised through `Intl.RelativeTimeFormat`. */
export interface LocaleStrings {
  today: string;
  clear: string;
  prevMonth: string;
  nextMonth: string;
  /** Accessible name of the calendar dialog. */
  label: string;
  /** Time selector (`enableTime`): group name and the three field names. */
  time: string;
  hours: string;
  minutes: string;
  seconds: string;
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
  /** Time selector row and its number fields (`enableTime`). */
  time: string;
  timeField: string;
  /** Visually hidden (screen-reader only) text. */
  sr: string;
}

export interface DatepickerOptions {
  /** `'single'` (default). `'range'` / `'multiple'` require importing their module first. */
  mode?: DatepickerMode;

  /** Initial / new selection. Takes precedence over the input's existing value. */
  selected?: DateInput | DateInput[] | null;
  /** Month shown (and day focused) when nothing is selected. Defaults to today. */
  defaultDate?: DateInput | null;

  /** `Date`, ISO `yyyy-MM-dd` string or Unix timestamp in seconds. */
  minDate?: DateInput | null;
  maxDate?: DateInput | null;
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

  /**
   * Also pick a time (hours : minutes : seconds, 24-hour) in a selector below the calendar. Selected dates keep
   * their time, which is shown as `HH:mm:ss` after the date, and included in `getDate()`, `onChange` and timestamps.
   * Requires `import 'ten-protons-datepicker/time'` (the web component loads it for you). In range / multiple mode
   * one time applies to every selected date. Default `false`.
   */
  enableTime?: boolean;
  /** Allow typing a date. Default `true`. When `false` the input is read-only. */
  allowInput?: boolean;
  /** Close once a selection is complete. Defaults to `true` for single/range, `false` for multiple and with `enableTime`. */
  closeOnSelect?: boolean;
  closeOnOutsideClick?: boolean;

  /** Replace default CSS class names. */
  classes?: Partial<ClassNames>;
  /**
   * Report Unix timestamps (seconds, local midnight of each selected day) from `getDate()`, `onChange`,
   * the `change` event, `isoInput` and the web component's form value, instead of `Date`s / ISO strings.
   * Day pickers report each day's local midnight; with `enableTime` the timestamp includes the selected time.
   * Typed or pasted timestamps are always understood, whatever this is set to. Default `false`.
   */
  outputTimestamp?: boolean;
  /** Input that receives the ISO value (`yyyy-MM-dd`, or `yyyy-MM-ddTHH:mm:ss` with `enableTime`; ranges as `a/b`, multiple as `a,b`), or timestamps with `outputTimestamp`. */
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
