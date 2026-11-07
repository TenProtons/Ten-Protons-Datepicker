import { addDays, addMonths } from './Day';

/**
 * Day to focus after a grid key press (WAI-ARIA date picker pattern), or `null` if the key
 * isn't a navigation key. Left/Right are mirrored in RTL so they follow the visual direction.
 */
export const nextFocus = (e: KeyboardEvent, d: Date, firstDay: number, rtl: boolean): Date | null => {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const dow = (d.getDay() - firstDay + 7) % 7;
  const dir = rtl ? -1 : 1;
  switch (e.key) {
    case 'ArrowLeft': return addDays(d, -dir);
    case 'ArrowRight': return addDays(d, dir);
    case 'ArrowUp': return addDays(d, -7);
    case 'ArrowDown': return addDays(d, 7);
    case 'Home': return addDays(d, -dow);
    case 'End': return addDays(d, 6 - dow);
    case 'PageUp': return addMonths(d, e.shiftKey ? -12 : -1);
    case 'PageDown': return addMonths(d, e.shiftKey ? 12 : 1);
    default: return null;
  }
};
