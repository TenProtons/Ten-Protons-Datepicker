import { registerLocale } from '../core/localization';
import type { LocaleObject } from '../core/types';

/** Ukrainian UI strings. Month and weekday names come from `Intl`. Importing registers `uk` for `<x-datepicker locale="uk">`. */
export const uk: LocaleObject = {
  code: 'uk',
  today: 'Сьогодні',
  clear: 'Очистити',
  prevMonth: 'Попередній місяць',
  nextMonth: 'Наступний місяць',
  label: 'Оберіть дату',
  selected: 'Обрано',
  time: 'Час',
  hours: 'Години',
  minutes: 'Хвилини',
  seconds: 'Секунди',
};

registerLocale(uk);
