import type { Datepicker } from '../core/Datepicker';
import { byDay, registerMode, type Mode } from '../core/modes';

/** Two clicks pick start and end (in any order); hovering / moving focus previews the span. */
const range: Mode = {
  max: 2,
  join: ' – ',
  iso: '/',
  autoClose: true,
  clean: (dates) => dates.slice(0, 2).sort(byDay),
  pick: (current, day) =>
    current.length === 1 ? { sel: [current[0]!, day].sort(byDay), complete: true } : { sel: [day], complete: false },
  span: (keys, hover) => {
    if (keys.length === 2) return [keys[0]!, keys[1]!];
    return keys.length === 1 && hover !== null ? [Math.min(keys[0]!, hover), Math.max(keys[0]!, hover)] : null;
  },
};

registerMode('range', range);

/** Switches `dp` to range mode: `const dp = withRange(new Datepicker(input))`. */
export const withRange = <T extends Datepicker>(dp: T): T => {
  dp.setOptions({ mode: 'range' });
  return dp;
};
