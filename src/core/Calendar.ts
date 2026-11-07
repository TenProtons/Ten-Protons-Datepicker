import { addDays, addMonths, dayKey, fromKey } from './Day';
import { nextFocus } from './keyboard';
import type { Locale } from './localization';
import type { ClassNames } from './types';

export const CLASSES: ClassNames = {
  root: 'tp-dp',
  pop: 'tp-pop',
  months: 'tp-months',
  head: 'tp-head',
  title: 'tp-title',
  nav: 'tp-nav',
  grid: 'tp-grid',
  dow: 'tp-dow',
  day: 'tp-day',
  out: 'tp-out',
  today: 'tp-today',
  selected: 'tp-selected',
  disabled: 'tp-disabled',
  inRange: 'tp-in-range',
  rangeStart: 'tp-range-start',
  rangeEnd: 'tp-range-end',
  foot: 'tp-foot',
  btn: 'tp-btn',
  sr: 'tp-sr',
};

export interface CalendarHandlers {
  pick(d: Date): void;
  /** Keyboard / disabled-day click: move the roving focus. */
  move(d: Date): void;
  nav(months: -1 | 1): void;
  hover(key: number | null): void;
  today(): void;
  clear(): void;
  close(): void;
}

export interface CalendarOptions {
  id: string;
  loc: Locale;
  cls: ClassNames;
  months: 1 | 2;
  otherMonths: boolean;
  inline: boolean;
  theme?: string;
  on: CalendarHandlers;
}

/** Everything `paint` needs; the calendar itself holds no selection state. */
export interface ViewState {
  /** First day of the first visible month. */
  view: Date;
  focus: Date;
  /** Selected day keys (a pending range start wins over the committed selection). */
  keys: number[];
  /** Run of days highlighted as a range. */
  span: [number, number] | null;
  /** `span` is a hover preview of an unfinished selection. */
  preview: boolean;
  today: number;
  disabled(d: Date): boolean;
  canPrev: boolean;
  canNext: boolean;
}

interface Cell {
  td: HTMLElement;
  d: Date;
  k: number;
  /** Belongs to a neighbouring month. */
  out: boolean;
  /** Neighbouring-month day that isn't displayed. */
  hidden: boolean;
}
interface Panel {
  title: HTMLElement;
  body: HTMLElement;
  cells: Cell[];
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k in attrs) e.setAttribute(k, attrs[k]!);
  return e;
};
const cx = (...a: Array<string | false | null | undefined>): string => a.filter(Boolean).join(' ');
/** Writes an attribute only when it changes (`null` removes it). */
const attr = (e: Element, name: string, v: string | null): void => {
  if (e.getAttribute(name) !== v) v === null ? e.removeAttribute(name) : e.setAttribute(name, v);
};

/**
 * The calendar DOM. Month changes rebuild the day cells (so assistive tech announces the newly
 * focused day); everything else - selection, hover, focus - only patches classes and attributes.
 */
export class Calendar {
  readonly el: HTMLElement;
  private panels: Panel[] = [];
  private live: HTMLElement;
  private prev: HTMLElement;
  private next: HTMLElement;
  private layoutKey = -1;
  private focusTd: HTMLElement | null = null;

  constructor(private o: CalendarOptions) {
    const { loc, cls, on } = o;
    const root = (this.el = h('div', cx(cls.root, !o.inline && cls.pop), {
      id: o.id,
      dir: loc.rtl ? 'rtl' : 'ltr',
      'aria-label': loc.strings.label,
      ...(o.inline ? { role: 'group' } : { role: 'dialog', 'aria-modal': 'true' }),
      ...(o.theme ? { 'data-theme': o.theme } : {}),
    }));

    const months = h('div', cls.months);
    for (let i = 0; i < o.months; i++) months.append(this.panel(i));

    const foot = h('div', cls.foot);
    for (const a of ['today', 'clear'] as const) {
      const b = h('button', cls.btn, { type: 'button', 'data-a': a });
      b.textContent = loc.strings[a];
      foot.append(b);
    }
    this.live = h('div', cls.sr, { 'aria-live': 'polite', 'aria-atomic': 'true' });
    root.append(months, foot, this.live);
    this.prev = root.querySelector<HTMLElement>('[data-a=prev]')!;
    this.next = root.querySelector<HTMLElement>('[data-a=next]')!;

    const dayOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('td[data-k]');
    root.addEventListener('click', (e) => {
      const td = dayOf(e);
      if (td) return on.pick(fromKey(+td.dataset.k!));
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (a === 'prev') on.nav(-1);
      else if (a === 'next') on.nav(1);
      else if (a === 'today') on.today();
      else if (a === 'clear') on.clear();
    });
    root.addEventListener('pointerover', (e) => {
      const td = dayOf(e);
      if (td) on.hover(+td.dataset.k!);
    });
    root.addEventListener('pointerleave', () => on.hover(null));
    root.addEventListener('keydown', (e) => this.onKey(e));
  }

  update(s: ViewState, focus = false): void {
    const key = dayKey(s.view);
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.layout(s.view);
    }
    this.paint(s);
    if (focus) this.focusCell();
  }

  focusCell(): void {
    this.focusTd?.focus({ preventScroll: true });
  }

  /** Screen-reader announcement (the live region is the only text that changes). */
  announce(text: string): void {
    this.live.textContent = text;
  }

  private panel(i: number): HTMLElement {
    const { loc, cls, id, months } = this.o;
    const titleId = `${id}-t${i}`;
    const nav = (a: 'prev' | 'next') =>
      h('button', cls.nav, { type: 'button', 'data-a': a, 'aria-label': loc.strings[a === 'prev' ? 'prevMonth' : 'nextMonth'] });

    const title = h('h2', cls.title, { id: titleId, 'aria-live': 'polite' });
    const head = h('div', cls.head);
    head.append(i === 0 ? nav('prev') : h('span', cls.nav), title, i === months - 1 ? nav('next') : h('span', cls.nav));

    const tr = h('tr');
    for (let c = 0; c < 7; c++) {
      const wd = (loc.firstDay + c) % 7;
      const th = h('th', cls.dow, { scope: 'col', abbr: loc.dow(wd, true) });
      th.textContent = loc.dow(wd);
      tr.append(th);
    }
    const thead = h('thead');
    thead.append(tr);
    const body = h('tbody');
    const table = h('table', cls.grid, { role: 'grid', 'aria-labelledby': titleId });
    table.append(thead, body);

    this.panels.push({ title, body, cells: [] });
    const wrap = h('div');
    wrap.append(head, table);
    return wrap;
  }

  private layout(view: Date): void {
    const { loc, cls, otherMonths } = this.o;
    this.panels.forEach((p, i) => {
      const m0 = addMonths(view, i);
      const first = addDays(m0, -((m0.getDay() - loc.firstDay + 7) % 7));
      const frag = document.createDocumentFragment();
      p.title.textContent = loc.title(m0);
      p.cells = [];
      for (let r = 0; r < 6; r++) {
        const tr = h('tr');
        let shown = false;
        for (let c = 0; c < 7; c++) {
          const d = addDays(first, r * 7 + c);
          const out = d.getMonth() !== m0.getMonth();
          const hidden = out && !otherMonths;
          const td = h('td', cls.day, { role: 'gridcell' });
          if (hidden) td.setAttribute('aria-hidden', 'true');
          else {
            shown = true;
            td.tabIndex = -1;
            td.dataset.k = String(dayKey(d));
            td.textContent = loc.num(d.getDate());
            td.setAttribute('aria-label', loc.label(d));
          }
          p.cells.push({ td, d, k: dayKey(d), out, hidden });
          tr.append(td);
        }
        if (!shown) tr.setAttribute('aria-hidden', 'true');
        frag.append(tr);
      }
      p.body.replaceChildren(frag);
    });
  }

  private paint(s: ViewState): void {
    const { cls } = this.o;
    const fk = dayKey(s.focus);
    const sp = s.span;
    this.focusTd = null;
    for (const p of this.panels) {
      for (const { td, d, k, out, hidden } of p.cells) {
        if (hidden) continue;
        const selected = s.keys.includes(k) || (!!sp && !s.preview && k >= sp[0] && k <= sp[1]);
        const disabled = s.disabled(d);
        const next = cx(
          cls.day,
          out && cls.out,
          k === s.today && cls.today,
          selected && cls.selected,
          disabled && cls.disabled,
          sp && k > sp[0] && k < sp[1] && cls.inRange,
          sp && k === sp[0] && cls.rangeStart,
          sp && k === sp[1] && cls.rangeEnd,
        );
        if (td.className !== next) td.className = next;
        attr(td, 'aria-selected', selected ? 'true' : null);
        attr(td, 'aria-disabled', disabled ? 'true' : null);
        attr(td, 'aria-current', k === s.today ? 'date' : null);
        const focusable = k === fk && !out;
        attr(td, 'tabindex', focusable ? '0' : '-1');
        if (focusable) this.focusTd = td;
      }
    }
    // aria-disabled (not `disabled`) so the buttons never drop focus at the limits.
    attr(this.prev, 'aria-disabled', s.canPrev ? null : 'true');
    attr(this.next, 'aria-disabled', s.canNext ? null : 'true');
  }

  private onKey(e: KeyboardEvent): void {
    const { loc, on, inline } = this.o;
    if (e.key === 'Escape') {
      if (inline) return;
      e.stopPropagation();
      return on.close();
    }
    if (e.key === 'Tab' && !inline) return this.trapTab(e);

    const td = (e.target as HTMLElement).closest<HTMLElement>('td[data-k]');
    if (!td) return;
    const d = fromKey(+td.dataset.k!);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return on.pick(d);
    }
    const to = nextFocus(e, d, loc.firstDay, loc.rtl);
    if (to) {
      e.preventDefault();
      on.move(to);
    }
  }

  /** aria-modal: Tab wraps inside the dialog. */
  private trapTab(e: KeyboardEvent): void {
    const f = [...this.el.querySelectorAll<HTMLElement>('button, td[tabindex="0"]')];
    const [first, last] = [f[0], f[f.length - 1]];
    const edge = e.shiftKey ? first : last;
    if (e.target === edge || !f.includes(e.target as HTMLElement)) {
      e.preventDefault();
      (e.shiftKey ? last : first)?.focus();
    }
  }
}
