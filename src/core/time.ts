import type { Grid } from './grid';
import type { Locale } from './localization';
import type { ClassNames } from './types';

/** Time of day: hours (0-23), minutes, seconds. */
export type Time = [hours: number, minutes: number, seconds: number];

export interface TimeUIOptions {
  loc: Locale;
  cls: ClassNames;
  id: string;
  /** The calendar's value grid: the fields open their values in it, in place of the days. */
  grid: Grid;
  /** Call with the new time whenever the user picks a value. */
  change(time: Time): void;
}

/** The time selector shown below the calendar. Provided by the optional `time` module. */
export interface TimeUI {
  el: HTMLElement;
  /** Shows `time` (without echoing a `change`). */
  set(time: Time): void;
}

export type TimeUIFactory = (options: TimeUIOptions) => TimeUI;

let factory: TimeUIFactory | undefined;

/** Called by `ten-protons-datepicker/time` when it is imported. */
export const registerTimeUI = (f: TimeUIFactory): void => {
  factory = f;
};
export const getTimeUI = (): TimeUIFactory | undefined => factory;

export const timeOf = (d: Date): Time => [d.getHours(), d.getMinutes(), d.getSeconds()];
