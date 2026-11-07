# Ten Protons Datepicker

Zero-dependency, accessible, framework-agnostic datepicker. Vanilla TypeScript + a native Web Component.

- WAI-ARIA date picker dialog pattern, full keyboard support, live-region announcements
- Single, range and multiple selection as separate, tree-shakeable modules
- `Intl`-based localisation, RTL, locale-derived input format, first day of week
- Manual input that is parsed on blur / Enter and validated against min / max / disabled dates
- CSS variables, light / dark (`prefers-color-scheme` or `data-theme`), replaceable class names
- ESM only, strict TypeScript types, no runtime dependencies

```sh
npm i @ten-protons/datepicker
```

## Web Component

```html
<script type="module">
  import '@ten-protons/datepicker/wc';
  import '@ten-protons/datepicker/locales/uk'; // optional UI strings for locale="uk"
</script>

<x-datepicker name="period" mode="range" locale="uk" min="2025-01-01" label="Period"></x-datepicker>
```

`mode="range"` / `mode="multiple"` load their module on demand, so single-date pages don't pay for them.

| Attribute | Notes |
| --- | --- |
| `value` | ISO: `2025-03-05`, range `2025-03-01/2025-03-10`, multiple `2025-03-01,2025-03-05` |
| `name`, `placeholder`, `label`, `disabled` | `label` is the input's accessible name. Form-associated where `ElementInternals` exists |
| `mode`, `locale`, `min`, `max`, `date-format`, `first-day`, `position`, `theme` | see [Options](#options) |
| `number-of-months`, `show-other-months`, `allow-input`, `close-on-select`, `disabled-days`, `inline` | booleans: present = true, `="false"` = false |

```js
const el = document.querySelector('x-datepicker');
el.value;                       // ISO string of the current selection
el.options = { disabledDates: (d) => d.getDay() === 0, onChange: console.log };
el.addEventListener('change', (e) => console.log(e.detail)); // also: open, close, monthChange, yearChange
await el.ready;                 // resolves with the underlying Datepicker
```

Style with `::part(input)`, `::part(toggle)` and the `--tp-*` variables.

## Imperative API

```ts
import { Datepicker } from '@ten-protons/datepicker';
import { withRange } from '@ten-protons/datepicker/range';
import '@ten-protons/datepicker/core.css';
import '@ten-protons/datepicker/themes.css';

const dp = withRange(new Datepicker(input, { locale: 'en-GB', minDate: new Date() }));

dp.addEventListener('change', (e) => console.log(e.detail)); // or onChange option
dp.setRange(start, end);
dp.getDate();    // Date | Date[] | null
dp.destroy();
```

Methods: `open() close() toggle() destroy() getDate() setDate(date, triggerChange?) setOptions(partial) jumpToDate(date) setRange(start, end)`.

`withMultiple` lives in `@ten-protons/datepicker/multiple`. Without the helpers, import the module for its side effect and pass `mode: 'range'`. Selecting a mode that isn't imported throws a descriptive error.

With `inline: true` the calendar renders inside the given element (any element, not just an input).

### Options

| Option | Default | |
| --- | --- | --- |
| `mode` | `'single'` | `'single' \| 'range' \| 'multiple'` |
| `selected`, `defaultDate` | | initial value / month shown when empty |
| `minDate`, `maxDate` | | `Date` or ISO `yyyy-MM-dd` |
| `disabledDates`, `disabledDaysOfWeek` | | `Date[]` or `(date) => boolean`; `0` = Sunday |
| `locale` | browser | BCP 47 tag or a `LocaleObject` |
| `firstDayOfWeek` | from locale | `0`–`6` |
| `dateFormat` | from locale | tokens: `yyyy yy MMMM MMM MM M dd d EEEE EEE`, quote literals: `d 'de' MMMM` |
| `inline`, `showOtherMonths`, `numberOfMonths` | `false`, `false`, `1` | `numberOfMonths: 1 \| 2` |
| `position` | `'auto'` | `auto top bottom left right`; auto flips above when there is no room below |
| `theme` | auto | `'light' \| 'dark'` |
| `allowInput` | `true` | `false` makes the input read-only |
| `closeOnSelect` | `true` (single, range), `false` (multiple) | |
| `closeOnOutsideClick` | `true` | outside pointer-down or focus |
| `classes` | | replace any default class name (`ClassNames`) |
| `isoInput` | | input that receives the ISO value, e.g. a hidden field |
| `anchor`, `appendTo` | input, `document.body` | construction only |
| `onChange onOpen onClose onMonthChange` | | callbacks; the same events fire as `CustomEvent`s |

`setOptions` accepts everything except `inline`, `anchor` and `appendTo`.

## Input handling

Typing is parsed on blur or Enter (ISO is always accepted). Separators are matched leniently (`5/3/2025` parses with `dd.MM.yyyy`). Range text is `start – end`, multiple is comma separated.

- Valid: the selection, calendar and `isoInput` update and `change` fires.
- Invalid, disabled or too many dates: on Enter the input is marked `aria-invalid` and keeps its text; on blur it reverts to the last valid value.
- Empty text clears the selection.

`change` also dispatches native bubbling `input` / `change` events on the input, so `v-model`-style bindings work.

## Keyboard

| Key | Action |
| --- | --- |
| `↓` or `Alt+↓` in the input | open and move focus into the calendar |
| `← → ↑ ↓` | previous / next day, previous / next week (← → mirror in RTL) |
| `Home` / `End` | start / end of the week |
| `PageUp` / `PageDown` | previous / next month; with `Shift`, previous / next year |
| `Enter` / `Space` | select |
| `Escape` | close, focus returns to where it came from |
| `Tab` | cycles inside the dialog (`aria-modal`) |

Opening with the mouse keeps focus in the input so you can keep typing; opening with the keyboard, the toggle button or `open()` moves focus into the grid.

## Localisation

Month and weekday names, the default numeric format, first weekday and direction come from `Intl`. UI strings default to English (`today` is localised through `Intl.RelativeTimeFormat`). Override what you need:

```ts
new Datepicker(input, { locale: { code: 'de', clear: 'Löschen', prevMonth: 'Voriger Monat', nextMonth: 'Nächster Monat', label: 'Datum wählen', selected: 'Ausgewählt' } });
```

`months`, `monthsShort`, `weekdays`, `weekdaysShort`, `firstDayOfWeek` and `rtl` can be overridden as well. `registerLocale(obj)` makes a locale available by tag (that's how `@ten-protons/datepicker/locales/uk` works).

The calendar is always Gregorian, and manual input accepts Arabic-Indic and Persian digits.

## Theming

Import `core.css` (and `themes.css` for dark mode). Customise with CSS variables on `.tp-dp`:
`--tp-bg --tp-fg --tp-muted --tp-border --tp-hover --tp-accent --tp-accent-fg --tp-range --tp-focus --tp-radius --tp-cell --tp-pad --tp-z --tp-shadow --tp-font`.

Dark mode follows `prefers-color-scheme` unless `theme: 'light'` / `data-theme="light"`; `theme: 'dark'` forces it. To style with Tailwind or CSS Modules, pass `classes` and skip `core.css`.

## Browsers

Current Chrome, Firefox, Safari (14.1+) and Edge. Form association of the Web Component needs `ElementInternals` (Safari 16.4+); everywhere else it still works, but its value isn't submitted with a `<form>`. Use the `change` event or `isoInput` there.

## Not in v1 yet

Time picker, presets and a year / month picker view are not implemented. Month and year are reachable with the previous / next buttons and `PageUp` / `PageDown` (`Shift` for years).

## Development

```sh
npm install
npm run typecheck
npm run build      # tsup -> dist/
```

MIT
