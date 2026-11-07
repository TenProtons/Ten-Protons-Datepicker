import { dayKey } from '../core/Day';
import type { Datepicker } from '../core/Datepicker';
import { byDay, registerMode, type Mode } from '../core/modes';

/** Each click toggles a day; the popup stays open unless `closeOnSelect` is set. */
const multiple: Mode = {
  max: Infinity,
  join: ', ',
  iso: ',',
  autoClose: false,
  clean: (dates) => dates.filter((d, i) => dates.findIndex((o) => dayKey(o) === dayKey(d)) === i).sort(byDay),
  pick: (current, day) => {
    const k = dayKey(day);
    const has = current.some((d) => dayKey(d) === k);
    return { sel: has ? current.filter((d) => dayKey(d) !== k) : [...current, day].sort(byDay), complete: true };
  },
};

registerMode('multiple', multiple);

/** Switches `dp` to multiple mode: `const dp = withMultiple(new Datepicker(input))`. */
export const withMultiple = <T extends Datepicker>(dp: T): T => {
  dp.setOptions({ mode: 'multiple' });
  return dp;
};
