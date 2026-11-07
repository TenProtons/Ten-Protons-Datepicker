import type { Datepicker } from '../core/Datepicker';
import { registerTimeUI, type Time } from '../core/time';

const FIELDS = [
  ['hours', 23],
  ['minutes', 59],
  ['seconds', 59],
] as const;
const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * The 24-hour `HH : mm : ss` selector. Each field is a spinbutton: type digits, or use ArrowUp / ArrowDown
 * (wraps), Home / End. Values are clamped to range when committed (blur / Enter).
 */
registerTimeUI(({ loc, cls, change }) => {
  const el = document.createElement('div');
  el.className = cls.time;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', loc.strings.time);

  const time: Time = [0, 0, 0];
  const fields: Array<{ input: HTMLInputElement; render(): void }> = [];

  FIELDS.forEach(([name, max], i) => {
    const input = document.createElement('input');
    input.className = cls.timeField;
    const attrs = { type: 'text', inputmode: 'numeric', maxlength: '2', autocomplete: 'off', role: 'spinbutton', 'aria-label': loc.strings[name], 'aria-valuemin': '0', 'aria-valuemax': String(max) };
    for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);

    const render = () => {
      input.value = pad(time[i]!);
      input.setAttribute('aria-valuenow', String(time[i]));
    };
    const apply = (v: number) => {
      time[i] = Math.min(max, Math.max(0, v));
      render();
      change([...time]);
    };
    const commit = () => {
      const n = parseInt(input.value, 10);
      isNaN(n) ? render() : apply(n);
    };

    input.addEventListener('input', () => (input.value = input.value.replace(/\D/g, '')));
    input.addEventListener('change', commit);
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') apply((time[i]! + (e.key === 'ArrowUp' ? 1 : -1) + max + 1) % (max + 1));
      else if (e.key === 'Home') apply(0);
      else if (e.key === 'End') apply(max);
      else if (e.key === 'Enter') commit();
      else return;
      e.preventDefault();
    });

    if (i) {
      const colon = document.createElement('span');
      colon.textContent = ':';
      colon.setAttribute('aria-hidden', 'true');
      el.append(colon);
    }
    el.append(input);
    fields.push({ input, render });
  });

  return {
    el,
    // A field being typed in keeps its text until committed.
    set(t) {
      time.splice(0, 3, ...t);
      fields.forEach(({ input, render }) => (input.getRootNode() as Document | ShadowRoot).activeElement === input || render());
    },
  };
});

/** Switches `dp` to date & time: `const dp = withTime(new Datepicker(input))`. */
export const withTime = <T extends Datepicker>(dp: T): T => {
  dp.setOptions({ enableTime: true });
  return dp;
};
