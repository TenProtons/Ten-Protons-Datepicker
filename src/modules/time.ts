import { h } from '../core/Calendar';
import type { Datepicker } from '../core/Datepicker';
import { registerTimeUI, type Time } from '../core/time';

// [name, options, columns]: hours 6 x 4, minutes and seconds 10 x 6 (row = tens digit).
const FIELDS = [
  ['hours', 24, 6],
  ['minutes', 60, 10],
  ['seconds', 60, 10],
] as const;
const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * The 24-hour `HH : mm : ss` selector. Each field is a button that opens a grid of its values in place of the days;
 * picking a value sets it and returns to the days. Arrows, Home / End move in the grid, Enter / Space pick, Escape closes it.
 */
registerTimeUI(({ loc, cls, id, months, change }) => {
  const { strings } = loc;
  const el = h('div', cls.time, { role: 'group', 'aria-label': strings.time });
  const time: Time = [0, 0, 0];
  const listId = `${id}-tl`;
  /** Index of the field whose grid is shown, or -1 for the days. */
  let open = -1;

  const title = h('h2', cls.title, { id: `${id}-tt` });
  const back = h('button', cls.nav, { type: 'button', 'data-a': 'back', 'aria-label': strings.back });
  const head = h('div', cls.head);
  head.append(back, title, h('span', cls.nav));
  const list = h('div', cls.timeList, { id: listId, role: 'listbox', 'aria-labelledby': title.id });
  const panel = h('div', cls.timePanel);
  panel.append(head, list);

  const fields = FIELDS.map((_, i) => {
    const btn = h('button', cls.timeField, { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
    btn.addEventListener('click', () => (open === i ? close(true) : show(i)));
    if (i) el.append(Object.assign(h('span', '', { 'aria-hidden': 'true' }), { textContent: ':' }));
    el.append(btn);
    return btn;
  });

  const render = () =>
    fields.forEach((btn, i) => {
      const text = pad(time[i]!);
      if (btn.textContent === text) return;
      btn.textContent = text;
      btn.setAttribute('aria-label', `${strings[FIELDS[i]![0]]}, ${text}`);
    });

  /** Shows the grid (or the days when none is open) and mirrors that on the fields and the month panels. */
  const sync = () => {
    open < 0 ? panel.remove() : months.append(panel);
    for (const c of months.children) c.toggleAttribute('inert', open >= 0 && c !== panel);
    fields.forEach((btn, i) => {
      btn.setAttribute('aria-expanded', String(i === open));
      i === open ? btn.setAttribute('aria-controls', listId) : btn.removeAttribute('aria-controls');
    });
  };

  const mark = () =>
    [...list.children].forEach((o, v) => {
      const on = v === time[open];
      o.className = [cls.timeOpt, open > 0 && v % 5 === 0 && cls.timeFive, on && cls.selected].filter(Boolean).join(' ');
      o.setAttribute('aria-selected', String(on));
    });

  /** Scrolls the list (only the list: `scrollIntoView` could move the page) just enough to show `o`. */
  const see = (o: HTMLElement) => {
    const { offsetTop: top, offsetHeight: height } = o;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + height > list.scrollTop + list.clientHeight) list.scrollTop = top + height - list.clientHeight;
  };

  /** Roving tabindex: `o` becomes the grid's single tab stop and takes focus. */
  const focusOpt = (o: HTMLElement) => {
    list.querySelector<HTMLElement>('[tabindex="0"]')?.setAttribute('tabindex', '-1');
    o.tabIndex = 0;
    o.focus({ preventScroll: true });
    see(o);
  };

  const show = (i: number) => {
    const [name, count, cols] = FIELDS[i]!;
    open = i;
    title.textContent = strings[name];
    list.style.setProperty('--tp-cols', String(cols));
    list.replaceChildren(
      ...Array.from({ length: count }, (_, v) => Object.assign(h('div', '', { role: 'option', tabindex: '-1' }), { textContent: pad(v) })),
    );
    mark();
    sync();
    focusOpt(list.children[time[i]!] as HTMLElement);
  };

  const close = (focus = false): boolean => {
    if (open < 0) return false;
    if (focus) fields[open]!.focus({ preventScroll: true });
    open = -1;
    sync();
    return true;
  };

  const pick = (v: number) => {
    time[open] = v;
    render();
    close(true);
    change([...time]);
  };

  back.addEventListener('click', () => close(true));
  const optOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('[role=option]');
  list.addEventListener('click', (e) => {
    const o = optOf(e);
    if (o) pick([...list.children].indexOf(o));
  });
  // Grid keys stop here, so the calendar's day-grid handler never sees them (Escape and Tab do reach it).
  panel.addEventListener('keydown', (e) => {
    const o = optOf(e);
    if (!o) return;
    const [v, last, cols] = [[...list.children].indexOf(o), list.children.length - 1, FIELDS[open]![2]];
    const dx = loc.rtl ? -1 : 1;
    const step: Record<string, number> = { ArrowRight: dx, ArrowLeft: -dx, ArrowDown: cols, ArrowUp: -cols };
    if (e.key === 'Enter' || e.key === ' ') pick(v);
    else if (e.key === 'Home' || e.key === 'End' || e.key in step) {
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? last : v + step[e.key]!;
      if (to >= 0 && to <= last) focusOpt(list.children[to] as HTMLElement); // no wrapping
    } else return;
    e.preventDefault();
    e.stopPropagation();
  });

  return {
    el,
    set(t) {
      time.splice(0, 3, ...t);
      render();
      if (open >= 0) mark();
    },
    close,
  };
});

/** Switches `dp` to date & time: `const dp = withTime(new Datepicker(input))`. */
export const withTime = <T extends Datepicker>(dp: T): T => {
  dp.setOptions({ enableTime: true });
  return dp;
};
