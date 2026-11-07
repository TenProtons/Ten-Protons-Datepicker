import { dayKey } from './Day';

/** Selection strategy. `single` is built in; `range` and `multiple` register themselves when imported. */
export interface Mode {
  /** Most dates a selection can hold. */
  max: number;
  /** Separator between dates in the input text. */
  join: string;
  /** Separator between dates in the ISO value. */
  iso: string;
  /** Close the popup when a selection completes (overridable by `closeOnSelect`). */
  autoClose: boolean;
  /** Sorts / limits / dedupes an arbitrary list of days into a valid selection. */
  clean(dates: Date[]): Date[];
  /** Selection after `day` is activated. `complete: false` keeps it pending (e.g. range start). */
  pick(current: Date[], day: Date): { sel: Date[]; complete: boolean };
  /** Inclusive run of day keys to highlight; `hover` is the day under the pointer / focus. */
  span?(keys: number[], hover: number | null): [number, number] | null;
}

export const byDay = (a: Date, b: Date): number => dayKey(a) - dayKey(b);

const modes: Record<string, Mode> = {
  single: {
    max: 1,
    join: ', ',
    iso: ',',
    autoClose: true,
    clean: (d) => d.slice(0, 1),
    pick: (_, day) => ({ sel: [day], complete: true }),
  },
};

export const registerMode = (name: string, mode: Mode): void => {
  modes[name] = mode;
};
export const getMode = (name: string): Mode | undefined => modes[name];
