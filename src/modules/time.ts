import type { Datepicker } from '../core/Datepicker';
import { h } from '../core/dom';
import { registerTimeUI, type Time } from '../core/time';

// [name, options, columns]: hours 6 x 4, minutes and seconds 5 x 12 (a row per 5 minutes, so the bold multiples of 5 line up).
// The column count is the one source for the CSS (`--tp-cols`) and the arrow keys.
const FIELDS = [
  ['hours', 24, 6],
  ['minutes', 60, 5],
  ['seconds', 60, 5],
] as const;
const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * The 24-hour `HH : mm : ss` selector. Each field is a button that opens a grid of its values (the calendar's shared
 * value grid) in place of the days; picking a value sets it and returns to the days.
 */
registerTimeUI(({ loc, cls, grid, change }) => {
  const { strings } = loc;
  const el = h('div', cls.time, { role: 'group', 'aria-label': strings.time });
  const time: Time = [0, 0, 0];

  const fields = FIELDS.map(([name, count, cols], i) => {
    const btn = h('button', cls.timeField, { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
    btn.addEventListener('click', () =>
      grid.trigger === btn
        ? grid.close(true)
        : grid.open({
            trigger: btn,
            title: strings[name],
            cols,
            selected: time[i]!,
            options: Array.from({ length: count }, (_, v) => ({ text: pad(v), find: String(v), cls: i > 0 && v % 5 === 0 ? cls.timeFive : undefined })),
            pick: (v) => {
              time[i] = v;
              render();
              grid.close(true);
              change([...time]);
            },
          }),
    );
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

  return {
    el,
    set(t) {
      time.splice(0, 3, ...t);
      render();
      const open = fields.findIndex((btn) => btn === grid.trigger);
      if (open >= 0) grid.select(time[open]!);
    },
  };
});

/** Switches `dp` to date & time: `const dp = withTime(new Datepicker(input))`. */
export const withTime = <T extends Datepicker>(dp: T): T => {
  dp.setOptions({ enableTime: true });
  return dp;
};
