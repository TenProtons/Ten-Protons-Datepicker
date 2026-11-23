import { attr, cx, h } from './dom';
import { latin } from './format';
import type { Locale } from './localization';
import type { ClassNames } from './types';

export interface GridOption {
  /** Shown text. */
  text: string;
  /** Second text type-ahead matches, e.g. the unpadded value of "05". */
  find?: string;
  /** Extra class (e.g. bold multiples of 5). */
  cls?: string;
  /** The current month / year. */
  today?: boolean;
  /** Visible but not pickable (`aria-disabled`). */
  off?: boolean;
}

export interface GridConfig {
  /** The button that opens the grid: gets `aria-expanded` / `aria-controls`, and focus returns to it. */
  trigger: HTMLElement;
  /** Heading of the grid (the unit name). */
  title: string;
  options: GridOption[];
  cols: number;
  /** Columns share the full width (month / year) instead of being day-cell squares (time). */
  wide?: boolean;
  /** Index of the selected option; the grid opens centred on it. */
  selected: number;
  /** An option was chosen (never called for a disabled one). */
  pick(i: number): void;
}

/** The value grid that replaces the days, shared by the time fields and the month / year buttons: one is open at a time. */
export interface Grid {
  /** The panel (attached to the months block only while open). */
  readonly el: HTMLElement;
  /** Trigger of the open grid, `null` when the days are shown. */
  readonly trigger: HTMLElement | null;
  /** Opens the grid, closing whichever was open. */
  open(config: GridConfig): void;
  /** Moves the selected mark to option `i` of the open grid. */
  select(i: number): void;
  /** Back to the days (`focus`: to the trigger first). `false` if no grid was open. */
  close(focus?: boolean): boolean;
}

export interface GridOptions {
  loc: Locale;
  cls: ClassNames;
  id: string;
  /** The months block: the grid is shown over it and its other children become `inert`. */
  months: HTMLElement;
}

const TYPE_MS = 500;

/**
 * Builds the grid. The panel is attached to `months` only while open, so its options are never hidden descendants that
 * `trapTab` would have to filter. Options are divs on purpose: `trapTab` collects every `button`.
 * Keys (they stop here, so the calendar's day-grid handler never sees them; Escape and Tab do reach it):
 * arrows in 2D without wrapping (← → mirrored in RTL), Home / End, PageUp / PageDown by a visible page, type-ahead,
 * Enter picks on keydown and Space on keyup (a keyup landing on the trigger focus returns to would reopen the grid).
 */
export const createGrid = ({ loc, cls, id, months }: GridOptions): Grid => {
  const title = h('h2', cls.title, { id: `${id}-gt` });
  const back = h('button', cls.nav, { type: 'button', 'data-a': 'back', 'aria-label': loc.strings.back });
  const head = h('div', cls.head);
  head.append(back, title, h('span', cls.nav));
  const list = h('div', cls.timeList, { id: `${id}-gl`, role: 'listbox', 'aria-labelledby': title.id });
  const el = h('div', cls.timePanel);
  el.append(head, list);
  const proto = h('div', '', { role: 'option', tabindex: '-1' });

  let cur: GridConfig | null = null;
  /** The option elements (a plain array: indexing a live collection of 9999 years is slow). */
  let els: HTMLElement[] = [];
  let sel = -1;
  let rove: HTMLElement | null = null;
  let buf = '';
  let typedAt = 0;
  let spaceDown = false;

  const flag = (t: HTMLElement, on: boolean) => {
    t.setAttribute('aria-expanded', String(on));
    on ? t.setAttribute('aria-controls', list.id) : t.removeAttribute('aria-controls');
  };

  const mark = (i: number) => {
    const o = cur!.options[i];
    const e = els[i];
    if (!o || !e) return;
    e.className = cx(cls.timeOpt, o.cls, o.today && cls.today, o.off && cls.disabled, i === sel && cls.selected);
    e.setAttribute('aria-selected', String(i === sel));
    attr(e, 'aria-disabled', o.off ? 'true' : null);
    attr(e, 'aria-current', o.today ? 'date' : null);
  };

  /**
   * Roving tabindex: `o` becomes the grid's single tab stop and takes focus. Only the list is scrolled, by hand
   * (`scrollIntoView` and a plain `focus()` could move the page): centred on open, else just enough to show `o`.
   */
  const focusOpt = (o: HTMLElement, centre = false) => {
    rove?.setAttribute('tabindex', '-1');
    (rove = o).tabIndex = 0;
    o.focus({ preventScroll: true });
    const { offsetTop: top, offsetHeight: height } = o;
    if (centre) list.scrollTop = top - (list.clientHeight - height) / 2;
    else if (top < list.scrollTop) list.scrollTop = top;
    else if (top + height > list.scrollTop + list.clientHeight) list.scrollTop = top + height - list.clientHeight;
  };

  const choose = (i: number) => {
    if (cur && !cur.options[i]?.off) cur.pick(i);
  };
  const indexOf = (e: Event): number => {
    const o = (e.target as HTMLElement).closest('[role=option]');
    return o ? els.indexOf(o as HTMLElement) : -1;
  };

  /** First option from `from` (wrapping) whose text or value starts with `prefix`. */
  const match = (prefix: string, from: number): number => {
    const n = cur!.options.length;
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n;
      const { text, find } = cur!.options[i]!;
      if ([text, find ?? ''].some((s) => s.toLocaleLowerCase(loc.code).startsWith(prefix))) return i;
    }
    return -1;
  };

  /** Type-ahead: the whole buffer first; failing that, one repeated character cycles through its matches after the focused option. */
  const typeAhead = (key: string, v: number, at: number): number => {
    buf = (at - typedAt > TYPE_MS ? '' : buf) + latin(key).toLocaleLowerCase(loc.code);
    typedAt = at;
    const i = match(buf, 0);
    return i >= 0 || [...buf].some((c) => c !== buf[0]) ? i : match(buf[0]!, v + 1);
  };

  /** Option to focus for a key pressed on option `v` (`v` itself at the ends, -1 for a type-ahead miss), or `null` if it isn't a grid key. */
  const target = (e: KeyboardEvent, v: number): number | null => {
    const { cols } = cur!;
    const last = els.length - 1;
    const dx = loc.rtl ? -1 : 1;
    // Rows that fit fully; a list without overflow (hours, months) has one page: PageUp / PageDown go to its first / last row.
    const page = list.scrollHeight > list.clientHeight ? Math.max(1, Math.floor(list.clientHeight / els[v]!.offsetHeight)) : Infinity;
    const to = (n: number) => (n >= 0 && n <= last ? n : v); // no wrapping
    switch (e.key) {
      case 'ArrowRight': return to(v + dx);
      case 'ArrowLeft': return to(v - dx);
      case 'ArrowDown': return to(v + cols);
      case 'ArrowUp': return to(v - cols);
      case 'Home': return 0;
      case 'End': return last;
      case 'PageDown': return v + cols * Math.min(page, Math.floor((last - v) / cols));
      case 'PageUp': return v - cols * Math.min(page, Math.floor(v / cols));
      default: return e.key.length === 1 && e.key !== ' ' ? typeAhead(e.key, v, e.timeStamp) : null;
    }
  };

  back.addEventListener('click', () => close(true));
  list.addEventListener('click', (e) => {
    const i = indexOf(e);
    if (i >= 0) choose(i);
  });
  el.addEventListener('keydown', (e) => {
    const v = indexOf(e);
    if (v < 0 || !cur || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') choose(v);
    else if (e.key === ' ') spaceDown = true;
    else {
      const to = target(e, v);
      if (to === null) return;
      if (to >= 0) focusOpt(els[to]!);
    }
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener('keyup', (e) => {
    if (e.key !== ' ' || indexOf(e) < 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (spaceDown) choose(indexOf(e));
    spaceDown = false;
  });

  const close = (focus = false): boolean => {
    if (!cur) return false;
    const t = cur.trigger;
    cur = null;
    // Un-inert first (a browser won't focus an inert element), focus before the panel goes: focus never falls back to <body>.
    for (const c of months.children) c.removeAttribute('inert');
    if (focus) t.focus({ preventScroll: true });
    el.remove();
    flag(t, false);
    return true;
  };

  return {
    el,
    get trigger() {
      return cur?.trigger ?? null;
    },
    open(c) {
      if (cur) flag(cur.trigger, false);
      cur = c;
      sel = c.selected;
      buf = '';
      spaceDown = false;
      title.textContent = c.title;
      list.className = cx(cls.timeList, c.wide && cls.wide);
      list.style.setProperty('--tp-cols', String(c.cols));
      els = c.options.map((o) => Object.assign(proto.cloneNode() as HTMLElement, { textContent: o.text }));
      list.replaceChildren(...els);
      c.options.forEach((_, i) => mark(i));
      months.append(el);
      for (const x of months.children) x.toggleAttribute('inert', x !== el);
      flag(c.trigger, true);
      focusOpt(els[sel]!, true);
    },
    select(i) {
      if (!cur || i === sel) return;
      const old = sel;
      sel = i;
      mark(old);
      mark(i);
    },
    close,
  };
};
