import { Calendar, CLASSES, type CalendarHandlers, type ViewState } from './Calendar';
import { addMonths, dayKey, formatISO, monthStart, normDate, parseValueList, startOfDay, toDate, toInstant, toUnix } from './Day';
import { formatDate, formatTime, parseDates } from './format';
import { resolveLocale, type Locale } from './localization';
import { getMode, type Mode } from './modes';
import { place } from './positioning';
import { getTimeUI, timeOf, type Time } from './time';
import type { DateInput, DatepickerEventMap, DatepickerOptions, DatepickerValue, LocaleStrings } from './types';

const DEFAULTS: DatepickerOptions = {
  mode: 'single',
  position: 'auto',
  numberOfMonths: 1,
  allowInput: true,
  closeOnOutsideClick: true,
};

let uid = 0;
const definedOnly = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

// Typed `addEventListener('change', e => e.detail)`.
export interface Datepicker {
  addEventListener<K extends keyof DatepickerEventMap>(type: K, listener: (this: Datepicker, ev: DatepickerEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof DatepickerEventMap>(type: K, listener: (this: Datepicker, ev: DatepickerEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

/**
 * Accessible datepicker attached to an `<input>` (popup) or any element (`inline: true`).
 *
 * Opens on click or ArrowDown; with `allowInput` the date can be typed and is parsed on blur / Enter.
 * Emits `change`, `open`, `close`, `monthChange` and `yearChange` (as `CustomEvent`s on the instance
 * and through the `on*` callbacks). `change` also fires native `input`/`change` events on the input.
 *
 * ```ts
 * const dp = new Datepicker(input, { locale: 'uk', minDate: new Date() });
 * dp.addEventListener('change', (e) => console.log(e.detail));
 * ```
 */
export class Datepicker extends EventTarget {
  /** The element the picker is attached to. */
  readonly el: HTMLElement;

  private readonly input: HTMLInputElement | null;
  private readonly anchor: HTMLElement;
  private readonly id = `tp-${++uid}`;
  private user: DatepickerOptions = {};
  private o: DatepickerOptions = DEFAULTS;
  private loc!: Locale;
  private mode!: Mode;
  private fmt = '';
  private lo: Date | null = null;
  private hi: Date | null = null;
  private skip: Set<number> | null = null;

  private sel: Date[] = [];
  /** Unfinished selection (e.g. range start); only the committed `sel` is ever emitted. */
  private pending: Date[] | null = null;
  /** Time of day given to newly picked days (`enableTime`): follows the selection and the time selector. */
  private tod: Time = [0, 0, 0];
  private view = new Date();
  private focus = new Date();
  private hover: number | null = null;

  private cal: Calendar | null = null;
  private isOpen = false;
  private destroyed = false;
  private opener: HTMLElement | null = null;
  private wasReadOnly = false;
  private added: string[] = [];
  private offs: Array<() => void> = [];
  private openOffs: Array<() => void> = [];

  private handlers: CalendarHandlers = {
    pick: (d) => this.pick(d),
    move: (d) => this.move(d),
    nav: (n) => this.nav(n),
    hover: (k) => {
      if (k === this.hover) return;
      this.hover = k;
      if (this.pending) this.refresh();
    },
    today: () => this.pick(startOfDay(new Date())),
    clear: () => this.setSel([], true),
    close: () => this.hide(true),
    time: (t) => this.setTime(t),
  };

  constructor(el: HTMLElement, options: DatepickerOptions = {}) {
    super();
    this.el = el;
    this.input = el instanceof HTMLInputElement ? el : null;
    this.anchor = options.anchor ?? el;
    this.resolve(options);

    // A prefilled input is read straight into picker dates; `selected` is a value and goes through the UTC conversion.
    const typed = options.selected === undefined && this.input?.value.trim() ? this.read(this.input.value) : null;
    this.sel = typed ? this.mode.clean(typed) : this.normalize(options.selected);
    if (this.sel[0]) this.tod = timeOf(this.sel[0]);
    this.focus = this.clamp(this.sel[0] ?? this.home());
    this.view = monthStart(this.focus);

    if (this.input) this.bindInput(this.input);
    if (this.sel.length) this.writeInput();
    if (this.o.inline) {
      this.mount();
      this.isOpen = true;
      this.refresh();
    }
  }

  /** Localised UI strings in use (e.g. to label an external toggle button). */
  get strings(): LocaleStrings {
    return this.loc.strings;
  }

  /** Opens the popup and moves focus into the calendar. */
  open(): void {
    this.present(true);
  }

  /** Closes the popup and returns focus to where it came from. */
  close(): void {
    this.hide(true);
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  /**
   * Selected date(s): `Date | null` in single mode, `Date[] | null` otherwise (copies). With `outputTimestamp`
   * the dates are Unix timestamps in seconds instead: `number | null` / `number[] | null`. With `valueInUtc`
   * a date-only picker reports each day as UTC midnight.
   */
  getDate(): DatepickerValue {
    const { outputTimestamp, enableTime, valueInUtc } = this.o;
    const dates = this.sel.map((d) => (outputTimestamp ? toUnix(d, enableTime, valueInUtc) : toInstant(d, enableTime, valueInUtc)));
    return (this.mode.max === 1 ? (dates[0] ?? null) : dates.length ? dates : null) as DatepickerValue;
  }

  /**
   * Replaces the selection. Accepts `Date`s, ISO strings and Unix timestamps in seconds. Invalid dates are
   * ignored; `change` fires only if `triggerChange` is true.
   */
  setDate(date: DateInput | DateInput[] | null, triggerChange = false): void {
    if (this.destroyed) return;
    const next = this.normalize(date);
    if (next[0]) this.reveal(next[0]);
    this.setSel(next, triggerChange);
  }

  /** Shows the month of `date` and moves the keyboard focus to it (clamped to min/max). */
  jumpToDate(date: Date): void {
    const d = toDate(date, !!this.o.enableTime, !!this.o.valueInUtc);
    if (this.destroyed || !d) return;
    this.reveal(d);
    this.refresh();
  }

  /** Shorthand for `setDate([start, end])`; use in `range` mode. */
  setRange(start: Date, end: Date): void {
    this.setDate([start, end]);
  }

  /** Merges options. `inline`, `anchor` and `appendTo` are only read at construction. */
  setOptions(options: Partial<DatepickerOptions>): void {
    if (this.destroyed) return;
    const before = this.text();
    this.resolve({ ...this.user, ...options });
    // The current selection is already in picker form; only a new `selected` value is converted. Also drops / adds the time of day when `enableTime` changed.
    this.sel = 'selected' in options ? this.normalize(options.selected) : this.mode.clean(this.sel.map((d) => normDate(d, !!this.o.enableTime)));
    if (this.sel[0]) this.tod = timeOf(this.sel[0]);
    this.pending = null;
    this.focus = this.clamp(this.sel[0] ?? this.focus);
    if (this.input) this.input.readOnly = this.wasReadOnly || this.o.allowInput === false;
    if (before !== this.text()) this.writeInput();
    else if (this.o.isoInput) this.writeISO();

    // The calendar bakes locale/classes/month count into its DOM: rebuild it.
    const hadFocus = this.cal?.el.matches(':focus-within');
    this.cal?.el.remove();
    this.cal = null;
    this.reveal(this.focus);
    if (this.isOpen) {
      this.mount();
      this.cal!.el.hidden = false;
      this.refresh();
      this.reposition();
      if (hadFocus) this.cal!.focusCell();
    }
  }

  /** Removes the calendar, listeners and everything added to the input. The instance is unusable afterwards. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.openOffs.splice(0).forEach((f) => f());
    this.offs.splice(0).forEach((f) => f());
    this.cal?.el.remove();
    this.cal = null;
    this.isOpen = false;
    if (this.input) {
      [...this.added, 'aria-controls', 'aria-invalid'].forEach((n) => this.input!.removeAttribute(n));
      this.input.readOnly = this.wasReadOnly;
    }
  }

  // ---------------------------------------------------------------- options

  private resolve(user: DatepickerOptions): void {
    const o = { ...DEFAULTS, ...definedOnly(user) };
    const mode = getMode(o.mode!);
    if (!mode) {
      throw new Error(`[datepicker] mode "${o.mode}" is not registered. Import "ten-protons-datepicker/${o.mode}" first.`);
    }
    if (o.enableTime && !getTimeUI()) {
      throw new Error('[datepicker] enableTime needs the time module. Import "ten-protons-datepicker/time" first.');
    }
    this.user = user;
    this.o = o;
    this.mode = mode;
    this.loc = resolveLocale(o.locale, o.firstDayOfWeek);
    this.fmt = o.dateFormat ?? this.loc.format;
    const [time, utc] = [!!o.enableTime, !!o.valueInUtc];
    this.lo = toDate(o.minDate, time, utc);
    this.hi = toDate(o.maxDate, time, utc);
    const dd = o.disabledDates;
    this.skip = Array.isArray(dd) ? new Set(dd.map((d) => dayKey(toDate(d, time, utc) ?? d))) : null;
  }

  private monthsShown(): number {
    return this.o.numberOfMonths === 2 ? 2 : 1;
  }

  private home(): Date {
    return toDate(this.o.defaultDate, !!this.o.enableTime, !!this.o.valueInUtc) ?? startOfDay(new Date());
  }

  private isDisabled = (d: Date): boolean => {
    const k = dayKey(d);
    const dd = this.o.disabledDates;
    return (
      (this.lo !== null && k < dayKey(this.lo)) ||
      (this.hi !== null && k > dayKey(this.hi)) ||
      !!this.o.disabledDaysOfWeek?.includes(d.getDay()) ||
      !!this.skip?.has(k) ||
      (typeof dd === 'function' && dd(d))
    );
  };

  private clamp(d: Date): Date {
    const k = dayKey(d);
    if (this.lo && k < dayKey(this.lo)) return new Date(this.lo);
    if (this.hi && k > dayKey(this.hi)) return new Date(this.hi);
    return d;
  }

  // -------------------------------------------------------------- selection

  private normalize(v: unknown): Date[] {
    const list = v == null ? [] : Array.isArray(v) ? v : [v];
    const [time, utc] = [!!this.o.enableTime, !!this.o.valueInUtc];
    return this.mode.clean(list.map((x) => toDate(x, time, utc)).filter((d): d is Date => d !== null));
  }

  /** `d` with the picker's time of day; date-only pickers keep their midnights. */
  private stamp(d: Date): Date {
    if (!this.o.enableTime) return d;
    const x = new Date(d);
    x.setHours(...this.tod);
    return x;
  }

  private setSel(next: Date[], emit: boolean): void {
    // Days are the identity of a date-only selection; with a time, the instant is.
    const key = this.o.enableTime ? (d: Date) => +d : dayKey;
    const same = next.length === this.sel.length && next.every((d, i) => key(d) === key(this.sel[i]!));
    this.sel = next;
    if (next[0]) this.tod = timeOf(next[0]);
    this.pending = null;
    this.writeInput();
    this.refresh();
    if (emit && !same) this.emit('change', this.getDate());
  }

  private pick(d: Date): void {
    if (this.isDisabled(d)) return this.move(d);
    const day = this.stamp(d);
    const r = this.mode.pick(this.pending ?? this.sel, day);
    this.hover = dayKey(d);
    this.reveal(day);
    this.announce(r.sel);
    if (!r.complete) {
      this.pending = r.sel;
      return this.refresh(true);
    }
    this.setSel(r.sel, true);
    // With a time selector the popup stays open: the user still has to set the time.
    if (this.o.closeOnSelect ?? (this.mode.autoClose && !this.o.enableTime)) this.hide(true);
    else this.cal?.focusCell();
  }

  /** The time selector changed: every selected (or pending) date takes the new time of day. */
  private setTime(t: Time): void {
    this.tod = t;
    if (this.pending) {
      this.pending = this.pending.map((d) => this.stamp(d));
      this.refresh();
    } else if (this.sel.length) this.setSel(this.sel.map((d) => this.stamp(d)), true);
  }

  private announce(sel: Date[]): void {
    const { strings, label } = this.loc;
    const withTime = (d: Date) => (this.o.enableTime ? `${label(d)} ${formatTime(d)}` : label(d));
    this.cal?.announce(sel.length ? `${strings.selected}: ${sel.map(withTime).join(', ')}` : '');
  }

  // ------------------------------------------------------------------ view

  /** Focuses `d` (clamped) and scrolls the visible months to include it. */
  private reveal(d: Date): void {
    this.focus = this.clamp(d);
    const n = this.monthsShown();
    const m = monthStart(this.focus);
    const k = dayKey(m);
    let v = k < dayKey(this.view) ? m : k > dayKey(addMonths(this.view, n - 1)) ? addMonths(m, 1 - n) : this.view;
    if (this.lo && dayKey(v) < dayKey(monthStart(this.lo))) v = monthStart(this.lo);
    this.setView(v);
  }

  private setView(v: Date): void {
    const prev = this.view;
    if (dayKey(v) === dayKey(prev)) return;
    this.view = v;
    this.emit('monthChange', new Date(v));
    if (v.getFullYear() !== prev.getFullYear()) this.emit('yearChange', new Date(v));
  }

  private move(d: Date): void {
    this.reveal(d);
    this.hover = dayKey(this.focus);
    this.refresh(true);
  }

  private nav(delta: -1 | 1): void {
    const s = this.state();
    if (delta < 0 ? !s.canPrev : !s.canNext) return;
    this.focus = this.clamp(addMonths(this.focus, delta));
    this.setView(addMonths(this.view, delta));
    this.refresh();
  }

  private state(): ViewState {
    const keys = (this.pending ?? this.sel).map(dayKey);
    return {
      view: this.view,
      focus: this.focus,
      keys,
      span: this.mode.span?.(keys, this.hover) ?? null,
      preview: !!this.pending,
      today: dayKey(new Date()),
      time: this.tod,
      disabled: this.isDisabled,
      canPrev: !this.lo || dayKey(this.view) > dayKey(monthStart(this.lo)),
      canNext: !this.hi || dayKey(addMonths(this.view, this.monthsShown())) <= dayKey(this.hi),
    };
  }

  private refresh(focus = false): void {
    this.cal?.update(this.state(), focus);
  }

  // ----------------------------------------------------------------- popup

  private mount(): void {
    if (this.cal) return;
    const o = this.o;
    const cal = (this.cal = new Calendar({
      id: this.id,
      loc: this.loc,
      cls: { ...CLASSES, ...o.classes },
      months: this.monthsShown() as 1 | 2,
      otherMonths: !!o.showOtherMonths,
      inline: !!o.inline,
      theme: o.theme,
      time: o.enableTime ? getTimeUI() : undefined,
      on: this.handlers,
    }));
    if (o.inline) {
      this.input ? this.el.after(cal.el) : this.el.append(cal.el);
      return;
    }
    cal.el.hidden = true;
    (o.appendTo ?? this.el.ownerDocument.body).append(cal.el);
    this.input?.setAttribute('aria-controls', this.id);
  }

  private present(focusGrid: boolean): void {
    if (this.destroyed || this.o.inline) return;
    if (this.isOpen) return focusGrid ? this.cal?.focusCell() : undefined;
    this.mount();
    const cal = this.cal!;
    const active = (this.el.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
    this.opener = active === this.el.ownerDocument.body ? null : active; // Safari doesn't focus buttons on click
    this.reveal(this.sel[0] ?? this.focus); // no selection: keep the initial / jumped-to month
    cal.el.hidden = false;
    this.isOpen = true;
    this.refresh();
    this.reposition();
    this.input?.setAttribute('aria-expanded', 'true');
    this.listenWhileOpen();
    if (focusGrid) cal.focusCell();
    this.emit('open');
  }

  private hide(restoreFocus: boolean): void {
    if (!this.isOpen || this.o.inline) return;
    const cal = this.cal!;
    const hadFocus = restoreFocus && cal.el.matches(':focus-within');
    this.pending = null;
    this.hover = null;
    this.isOpen = false;
    cal.el.hidden = true;
    this.openOffs.splice(0).forEach((f) => f());
    this.input?.setAttribute('aria-expanded', 'false');
    if (hadFocus) (this.opener?.isConnected ? this.opener : this.el).focus({ preventScroll: true });
    this.emit('close');
  }

  private reposition = (): void => {
    if (this.cal && this.isOpen) place(this.anchor, this.cal.el, this.o.position ?? 'auto', this.loc.rtl);
  };

  private listenWhileOpen(): void {
    const doc = this.el.ownerDocument;
    const add = (t: EventTarget, type: string, fn: EventListener, capture = false) => {
      t.addEventListener(type, fn, capture);
      this.openOffs.push(() => t.removeEventListener(type, fn, capture));
    };
    if (this.o.closeOnOutsideClick !== false) {
      // composedPath() sees through open shadow roots (the web component case).
      const outside: EventListener = (e) => {
        const path = e.composedPath();
        if (!path.includes(this.cal!.el) && !path.includes(this.anchor)) this.hide(false);
      };
      add(doc, 'pointerdown', outside, true);
      add(doc, 'focusin', outside, true);
    }
    add(doc.defaultView ?? window, 'resize', this.reposition);
    add(doc, 'scroll', this.reposition, true);
  }

  // ----------------------------------------------------------------- input

  private on<K extends keyof HTMLElementEventMap>(t: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void): void {
    t.addEventListener(type, fn);
    this.offs.push(() => t.removeEventListener(type, fn));
  }

  private bindInput(i: HTMLInputElement): void {
    const setDefault = (name: string, value: string) => {
      if (i.hasAttribute(name)) return;
      i.setAttribute(name, value);
      this.added.push(name);
    };
    setDefault('aria-haspopup', 'dialog');
    setDefault('aria-expanded', 'false');
    setDefault('autocomplete', 'off');
    this.wasReadOnly = i.readOnly;
    i.readOnly = this.wasReadOnly || this.o.allowInput === false;

    this.on(i, 'click', () => this.present(this.o.allowInput === false));
    this.on(i, 'input', () => i.removeAttribute('aria-invalid'));
    this.on(i, 'blur', () => this.commitInput(true));
    this.on(i, 'keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.isOpen ? this.cal?.focusCell() : this.present(true);
      } else if (e.key === 'Enter') {
        const ok = this.commitInput(false);
        if (!ok || this.isOpen) e.preventDefault(); // keep the form from submitting an invalid / just-picked date
        if (ok) this.hide(false);
      } else if (e.key === 'Escape' && this.isOpen) {
        e.stopPropagation();
        this.hide(false);
      }
    });
  }

  /** Display text of the committed selection. */
  private text(): string {
    return this.sel.map((d) => formatDate(d, this.fmt, this.loc) + (this.o.enableTime ? ` ${formatTime(d)}` : '')).join(this.mode.join);
  }

  private writeISO(): void {
    const { isoInput, outputTimestamp, enableTime, valueInUtc } = this.o;
    if (isoInput) isoInput.value = this.sel.map((d) => (outputTimestamp ? toUnix(d, enableTime, valueInUtc) : formatISO(d, enableTime, valueInUtc))).join(this.mode.iso);
  }

  private writeInput(): void {
    if (this.input) {
      this.input.value = this.text();
      this.input.removeAttribute('aria-invalid');
    }
    this.writeISO();
  }

  /**
   * ISO dates / Unix timestamps (always accepted, whatever `dateFormat` is) or text in `dateFormat`. With
   * `enableTime` they carry a time ("15.03.2025 13:07:09"); a date typed without one takes the selector's time.
   */
  private read(text: string): Date[] | null {
    const time = !!this.o.enableTime;
    const iso = parseValueList(text, time, !!this.o.valueInUtc);
    return iso?.length ? iso : parseDates(text, this.fmt, this.loc, time ? this.tod : undefined);
  }

  /**
   * Parses the input text into the selection. Invalid, disabled or too many dates are rejected:
   * on Enter the input is flagged `aria-invalid` and keeps its text; on blur it reverts.
   */
  private commitInput(revertIfInvalid: boolean): boolean {
    const input = this.input;
    if (!input || this.destroyed) return true;
    const text = input.value.trim();
    if (text === this.text()) return true;

    let next: Date[] | null = [];
    if (text) {
      next = this.read(text);
      if (next && (next.length > this.mode.max || next.some(this.isDisabled))) next = null;
    }
    if (!next) {
      if (revertIfInvalid) this.writeInput();
      else input.setAttribute('aria-invalid', 'true');
      return false;
    }
    next = this.mode.clean(next);
    if (next[0]) this.reveal(next[0]);
    this.setSel(next, true);
    return true;
  }

  // ---------------------------------------------------------------- events

  private emit(type: keyof DatepickerEventMap, detail?: DatepickerValue | Date): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
    const o = this.o;
    if (type === 'change') {
      o.onChange?.(detail as DatepickerValue, this);
      // Frameworks that listen to the input (v-model, bind:value, ...) see the new value too.
      this.input?.dispatchEvent(new Event('input', { bubbles: true }));
      this.input?.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (type === 'open') o.onOpen?.(this);
    else if (type === 'close') o.onClose?.(this);
    else if (type === 'monthChange') o.onMonthChange?.(detail as Date, this);
  }
}
