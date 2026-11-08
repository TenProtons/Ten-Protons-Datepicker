# ARCHITECTURE.md — technical notes for the next session

**Audience: Claude (or any engineer) starting a new session with empty context.** Read this first, then `CLAUDE.md` (project rules, read automatically), then the code. It is internal: not listed in `package.json#files`, so it is not published to npm. `README.md` is the *user-facing* doc; this file is the *how it works and why* doc.

Snapshot: package `ten-protons-datepicker` v0.1.0, HEAD `b5396cc` ("added valueInUtc"), written 2026-11-08. If the code disagrees with this file, the code wins; fix this file.

## Contents
1. [Status in one screen](#1-status-in-one-screen)
2. [Working agreements](#2-working-agreements-with-the-user)
3. [Repo map](#3-repo-map)
4. [Public API](#4-public-api)
5. [The central idea: picker dates vs values](#5-the-central-idea-picker-dates-vs-values)
6. [Runtime architecture](#6-runtime-architecture)
7. [Feature deep-dives](#7-feature-deep-dives) (modes, input, time, UTC, timestamps, localization, web component, CSS)
8. [Traps and gotchas](#8-traps-and-gotchas-learned-the-hard-way)
9. [Testing: what exists and how I did it](#9-testing)
10. [Build, packaging, size](#10-build-packaging-size)
11. [Known limitations and open items](#11-known-limitations-and-open-items)
12. [Decision log](#12-decision-log)
13. [History](#13-history)

---

## 1. Status in one screen

Zero-dependency, framework-agnostic datepicker in strict TypeScript: an imperative `Datepicker` class plus a `<ten-protons-datepicker>` Web Component (alias `<x-datepicker>`). ESM only.

**Implemented:** single / range / multiple selection (range and multiple are separate modules); popup and inline calendar; one or two months; WAI-ARIA date-picker dialog pattern (roving tabindex grid, live region, focus trap, focus return); full keyboard navigation (RTL aware); manual input parsed on blur/Enter with validation; `Intl`-based localization (names, first weekday, RTL, derived default format); token `dateFormat`; min/max/disabled dates/weekdays; light/dark theming with CSS variables and replaceable class names; Unix timestamp input (always) and output (`outputTimestamp`); optional time selector (`enableTime`, separate module); UTC backend conversion (`valueInUtc`); `<x-datepicker>` with form association; a demo page; an English README.

**Not implemented:** presets, year/month picker view, ms timestamps, CJS build, custom time format, time-of-day min/max, different time per date in range/multiple, any automated tests in the repo (see §9), Ukrainian-only UI strings beyond `locales/uk`.

**Never verified:** behaviour in a real browser through a human (only jsdom + a few headless-Edge screenshots of the generated markup), screen readers, mobile, Safari/Firefox, `npm publish`, whether the name `ten-protons-datepicker` is free on npm.

**Size (measured from the user's own `dist/` at b5396cc, `gzip -9`):** core JS (`index` + shared chunks, concatenated) **≈ 8.9 KB** — *over* the 7.5 KB target in the original spec; `+range` ≈ +0.15 KB (9.0), `+time` ≈ +0.5 KB; `core.css` 1.4 KB, `themes.css` 0.3 KB; `wc.js` is 3.5 KB on its own (it inlines the CSS) on top of the core chunk. Core grew with timestamps, time parsing and the UTC conversion; trimming it is open work.

## 2. Working agreements with the user

From `CLAUDE.md` (read it; it is authoritative) and from this project's history:

- **Minimal, surgical diffs.** No unrelated refactors. Do not add features that were not asked for. Never break public API without explicit approval (changing the *type* of `DatepickerValue` was accepted explicitly when `outputTimestamp` was requested).
- **Do NOT build / bundle** unless the user asks. `npm run typecheck` (`tsc --noEmit`) is fine and is the standard check. The user builds (`dist/` exists, git-ignored) and runs `npm publish` themselves; they also commit and open PRs themselves.
- **Report honestly.** Say what was and was not verified; this user values corrections ("my earlier timezone runs were not really in those zones" was reported and appreciated).
- **Consider edge cases**: timezones/DST, invalid dates, RTL, screen readers, mobile keyboards.
- **Answer language/tone:** English; concise summaries; lead with the result.
- `~/.claude/CLAUDE.md` has a rule about `notifications.toastNotification` and Vue-style `computed`: it is for the user's *client apps*, not this library (the library has no notification layer). Ignore it here.
- Line endings: the repo is **LF**. Windows tooling (Python `open(..., 'w')`) writes CRLF — see §8.
- The user's primary locale is Ukrainian (`uk`); the user edits files in VS Code and runs Prettier on `demo/index.html` (the demo is Prettier-formatted: double quotes, wrapped lines — edit it with exact strings read from the current file).

## 3. Repo map

```
CLAUDE.md             project rules (auto-loaded)             ARCHITECTURE.md   this file
README.md             user-facing npm README (keep in sync)    LICENSE           MIT, "Ten Protons"
package.json          exports map, sideEffects, scripts        tsup.config.ts    5 entries, ESM, splitting
tsconfig.json         strict, ES2020, noUnused*, verbatimModuleSyntax, noEmit
demo/index.html       manual test page; imports from ../dist/* (so it needs a build)
dist/                 git-ignored build output (the user's)
src/
  index.ts            public re-exports: Datepicker, registerLocale, registerMode, byDay, types
  css.d.ts            `declare module '*.css'` (CSS is imported as text by tsup's loader)
  core/
    Datepicker.ts     THE class: state, options, selection, view, popup lifecycle, input binding, events (561 lines)
    Calendar.ts       DOM: builds/patches the calendar, delegated listeners, focus trap; default CLASSES (310)
    Day.ts            date math + THE value<->picker conversion (UTC/timestamp/ISO) (130)
    format.ts         token formatter + lenient parser for typed text, incl. times (86)
    localization.ts   resolveLocale(): Intl names, first weekday, RTL, default format, strings; locale registry (148)
    modes.ts          Mode interface + registry; only `single` is built in (37)
    time.ts           Time type + registry the optional time module plugs into (32)
    keyboard.ts       nextFocus(): key -> next day (WAI-ARIA grid keys, RTL mirror) (22)
    positioning.ts    place(): fixed-position popup placement with flip/clamp (24)
    types.ts          all public types (159)
  modules/            OPTIONAL, separately imported, self-registering
    range.ts          registers mode 'range'; exports withRange()
    multiple.ts       registers mode 'multiple'; exports withMultiple()
    time.ts           registers the HH:mm:ss selector UI; exports withTime()
  locales/uk.ts       Ukrainian UI strings; importing registers 'uk'
  wc/XDatepicker.ts   the custom element; wc/index.ts defines <ten-protons-datepicker> + alias <x-datepicker> (side effect)
  styles/core.css     all structural CSS + light vars; styles/themes.css  dark theme
```

Package entry points (`exports`): `.`, `./range`, `./multiple`, `./time`, `./wc`, `./locales/uk`, `./core.css`, `./themes.css`. `sideEffects` lists the self-registering files (`range`, `multiple`, `time`, `wc`, `locales/*`, `*.css`) so bundlers keep them.

## 4. Public API

### Class `Datepicker extends EventTarget`
`new Datepicker(el: HTMLElement, options?)` — `el` is an `<input>` (popup mode) or any element (`inline: true`).
Methods: `open()` (moves focus into the grid), `close()`, `toggle()`, `destroy()`, `getDate()`, `setDate(date, triggerChange = false)`, `setOptions(partial)`, `jumpToDate(date)`, `setRange(start, end)`, getter `strings`. Readonly `el`.
Events (CustomEvent on the instance, plus `on*` callbacks): `change` (detail = `getDate()`), `open`, `close`, `monthChange` (detail = `Date` of the 1st of the new month), `yearChange`. `change` additionally dispatches native bubbling `input` and `change` events on the input (for v-model style bindings). `addEventListener` is typed via interface merging with `DatepickerEventMap`.

### Options (`DatepickerOptions`, defaults in `DEFAULTS` + undefined = unset)
| Option | Default | Notes |
| --- | --- | --- |
| `mode` | `'single'` | `'range'`/`'multiple'` need their module imported, else `resolve()` throws a helpful error |
| `selected`, `defaultDate` | – | `DateInput` = `Date \| string \| number`; values (go through the conversion, §5) |
| `minDate`, `maxDate` | – | values, **day-based** (time of day ignored) |
| `disabledDates` | – | `Date[]` (values) or `(pickerDay: Date) => boolean` (receives the *displayed* day) |
| `disabledDaysOfWeek` | – | 0 = Sunday, on displayed days |
| `locale`, `firstDayOfWeek` | browser | string tag or `LocaleObject` |
| `dateFormat` | from locale | tokens `yyyy yy MMMM MMM MM M dd d EEEE EEE`, `'quoted'` literals; date part only |
| `inline` / `anchor` / `appendTo` | – | **read at construction only** |
| `showOtherMonths` / `numberOfMonths` (1\|2) / `position` / `theme` | false / 1 / 'auto' / auto | |
| `allowInput` | true | false ⇒ input is `readOnly` and click opens with focus in the grid |
| `showIcon` | `true` | adds class `tp-icon` to the bound input (calendar icon as CSS background, §7.8); applied in `bindInput` and `setOptions`, removed in `destroy`. The WC passes `false` (it has its own toggle button) |
| `closeOnSelect` | `mode.autoClose && !enableTime` | explicit value wins |
| `closeOnOutsideClick` | true | covers pointerdown *and* focusin outside |
| `classes` | – | partial `ClassNames` override (replaces defaults, §7.8) |
| `enableTime` | false | needs `ten-protons-datepicker/time` imported (the WC lazy-loads it) |
| `outputTimestamp` | false | report Unix **seconds** instead of Date / ISO |
| `valueInUtc` | false | backend is UTC (§7.5) |
| `isoInput` | – | an `<input>` that receives the machine value |
| `onChange/onOpen/onClose/onMonthChange` | – | |

`getDate()` returns `Date | Date[] | number | number[] | null` (copies; `Date` in single mode, array in range/multiple; `null` when empty; numbers with `outputTimestamp`). During an unfinished range pick it returns the *committed* selection only.

### Web component `<ten-protons-datepicker>` (alias `<x-datepicker>`)
Both tags are the same element: a class can only be `define`d once, so `wc/index.ts` registers `XDatepicker` as `x-datepicker` and an empty subclass as `ten-protons-datepicker`. Each registration is skipped if the tag is already taken. The README uses the long name (`x-datepicker` is generic and may collide with another library); the demo still uses `x-datepicker`. Never remove the alias: it is published API.
Attributes: `value`, `name`, `placeholder`, `label` (input `aria-label`), `disabled`, `mode`, `locale`, `min`, `max`, `date-format`, `first-day`, `position`, `theme`, `number-of-months`, `show-other-months`, `allow-input`, `close-on-select`, `disabled-days`, `output-timestamp`, `enable-time`, `value-in-utc`, `inline`. Boolean attrs: present = true, `="false"` = false. Properties: `value` (string, from the hidden iso input; setter sets the attribute), `options` (setter, for things attributes can't express), `ready` (Promise of the underlying `Datepicker`), `open/close/toggle()`. Events re-dispatched on the host (bubbles, composed). Parts: `wrap`, `input`, `toggle`.

## 5. The central idea: picker dates vs values

This is the invariant most likely to be broken by an edit. Read it twice.

* **Picker date** — what the picker stores internally (`sel`, `pending`, `focus`, `view`, `lo`/`hi`): a `Date` in the **browser's local time**. Date-only picker: *local midnight* of the day the user sees. With `enableTime`: the *local wall-clock* time to the second (`ms = 0`). All grid logic uses `dayKey(d)` (an integer `y*10000+m*100+d`, local fields) — never timestamps — so DST cannot skew comparisons.
* **Value** — what crosses the public API: `Date`, ISO string or Unix-seconds number going **in** (`selected`, `setDate`, `min/maxDate`, `defaultDate`, `disabledDates[]`, `jumpToDate`, WC `value`, typed ISO/timestamps) and `getDate()`/events/`isoInput`/WC `value` going **out**.

`Day.ts` is the *only* place the two meet:

| function | direction | behaviour |
| --- | --- | --- |
| `fromInstant(d, time, utc)` (private) | value → picker | `utc && !time` ⇒ the **UTC calendar day** of the instant (`makeDate(getUTC*)`); otherwise `normDate(d, time)` (local midnight, or keep time minus ms) |
| `toInstant(d, time, utc)` | picker → value | `utc && !time` ⇒ **UTC midnight** of the picker day; otherwise `new Date(d)` (same instant) |
| `toUnix(d, time, utc)` | picker → value | `floor(toInstant(...)/1000)` |
| `formatISO(d, time, utc)` | picker → value | `yyyy-MM-dd`; with `time`: `yyyy-MM-ddTHH:mm:ss` (local, no zone) or with `utc` the UTC instant `…Z` |
| `parseISO(s, time, utc)` | value → picker | ISO date or date-time (`T` or space, optional `.fff`, optional `Z`/`±hh[:]mm`); zone-less date-time = local, or UTC with `utc`; a zone always wins; a **bare date names a calendar day** (no conversion) except a time picker + `utc` reads it as UTC midnight |
| `parseUnix(s, time, utc)` | value → picker | `^\d{9,11}$` only (seconds, years 1973–5138) |
| `parseValueList(text, time, utc)` | value → picker | scans for ISO/timestamp tokens separated by whitespace `, ; /` dashes; `null` if anything else remains |
| `toDate(v, time, utc)` | value → picker | `Date`/string/number → picker date or `null` |
| `normDate(d, time)` | picker → picker | strip to midnight, or keep time minus ms |

Where the conversion is **applied** (all in `Datepicker.ts`): `resolve()` (`lo`, `hi`, `skip`), `home()`, `normalize()` (used by the constructor for `selected`, `setDate`, `setOptions({selected})`), `jumpToDate`, `read()` (typed ISO/timestamps), `getDate()`, `writeISO()`.

Where it must **NOT** be applied (these are bugs I almost shipped, now handled):
1. The picker's *existing* selection (`this.sel`) is already in picker form. `setOptions` re-normalises it with `normDate`, **not** `normalize()` (which would convert again and shift days east of UTC).
2. A prefilled `<input>` value goes through `read()` (already picker dates) and straight to `mode.clean`, **not** through `normalize()`. The constructor has a comment about this.
3. `parseDates()` (typed *display-format* text) is local wall-clock — it is what the user sees. Never convert it.
4. `disabledDates` as a function and `disabledDaysOfWeek` operate on displayed days.

Default (`valueInUtc` false, `enableTime` false) behaviour must remain: value == local midnight `Date`.

## 6. Runtime architecture

```
                         ┌───────────── options / WC attributes ─────────────┐
 typed text ─┐           ▼                                                   │
 setDate()  ─┼─► Day.ts (values → picker dates) ─► Datepicker { sel, pending, tod, focus, view, hover }
 selected   ─┘                                              │  state()  (pure snapshot: ViewState)
                                                            ▼
 pointer/keyboard ─► Calendar (delegated listeners) ─handlers─► Datepicker.pick/move/nav/setTime/…
                          ▲ update(ViewState): layout() on month change, else paint()
                          │
 Datepicker ─► getDate()/writeISO()/emit()  ─ picker dates → values (Day.ts) ─► app, isoInput, events
```

* **`Datepicker` owns all state**; `Calendar` is a dumb view: `update(ViewState, focus?)` where `ViewState = { view, focus, keys, span, preview, today, time, disabled(), canPrev, canNext }`. `Datepicker.refresh(focus = false)` = `cal?.update(state(), focus)`; it is cheap and called after every change.
* **State fields:** `sel` (committed picker dates), `pending` (unfinished selection, e.g. range start; shown but never emitted; cleared on commit/close), `tod` (time of day given to newly picked days; follows `sel[0]` and the selector; survives Clear), `view` (first day of the first visible month), `focus` (roving-focus day, always clamped to min/max and inside the visible months), `hover` (day key for range preview; set by pointer *and* keyboard focus moves).
* **`reveal(d)`** = clamp `d`, set `focus`, shift `view` minimally so `focus` is visible (also never before `monthStart(min)`), emit `monthChange`/`yearChange` through `setView`. Callers: pick, move, open, setDate, commitInput, setOptions.
* **`setSel(next, emit)`** is the single commit point: compares (`dayKey` date-only, instant with `enableTime`), assigns, updates `tod` from `next[0]`, clears `pending`, `writeInput()` (text + `isoInput`), `refresh()`, and emits `change` only if changed *and* `emit`. It deliberately does **not** reveal (a range end in a later month must not scroll the view back); callers that need it call `reveal` first.
* **Registries (module-level singletons, shared across entry points thanks to tsup code-splitting):** `modes.ts` (`registerMode/getMode`), `time.ts` (`registerTimeUI/getTimeUI`), `localization.ts` (`registerLocale`). Optional modules register themselves at import time → hence `sideEffects` and ESM-only.
* **Lifecycle:** constructor → `resolve(options)` (throws if mode/time module missing) → initial selection → `bindInput` → inline `mount()`. Popup DOM is built lazily on first `present()`; `setOptions` throws away and rebuilds the calendar (it bakes locale/classes/month count), keeping focus if it was inside. `destroy()` removes listeners, DOM, and only the attributes it added (`added[]`, plus `aria-controls`, `aria-invalid`), restores `readOnly`.
* **Popup:** appended to `appendTo ?? document.body`, `position: fixed` (class `tp-pop`), positioned by `place(anchor, pop, position, rtl)` on open/scroll(capture)/resize. `'auto'` flips above when there is no room below and more above; always clamped 8 px inside the viewport. While open: capture-phase `pointerdown` and `focusin` listeners close it when `composedPath()` contains neither the popup nor `anchor` (works through the web component's open shadow root). Focus returns to `opener` (the active element at open, ignoring `<body>`) or `el` — only if focus was inside the popup and `restoreFocus` is true.
* **Opening rules:** click on the input opens **without** moving focus when `allowInput` (so the user can keep typing); `ArrowDown`, `open()` and the WC toggle button move focus into the grid. `allowInput:false` ⇒ readonly and focus goes to the grid.
* **Input binding (`bindInput`)**: sets `aria-haspopup=dialog`, `aria-expanded`, `autocomplete=off` (only if absent); `click`, `input` (clears `aria-invalid`), `blur` (`commitInput(true)`), `keydown` (ArrowDown open/focus grid; Enter commit + close, prevents form submit if invalid or if the popup was open; Escape closes and stops propagation).
* **`commitInput(revertIfInvalid)`**: if text equals current `text()` → no-op. Empty ⇒ clear. Else `read(text)`; reject if `null`, more dates than `mode.max`, or any date `isDisabled`. Invalid: blur ⇒ revert text; Enter ⇒ `aria-invalid="true"` and keep text. Valid: `mode.clean` → `reveal(first)` → `setSel(…, true)`.

### Calendar (`Calendar.ts`)
* Root: `div.tp-dp(.tp-pop)` with `role=dialog aria-modal=true aria-label` (inline: `role=group`, no modal), `dir` from the locale, optional `data-theme`. Children: `.tp-months` (1–2 panels: nav buttons / `h2[aria-live=polite]` / `table[role=grid]` with `th[scope=col][abbr]`), optional time selector, `.tp-foot` (Today, Clear), hidden live region `.tp-sr[aria-live=polite]`.
* `update()`: if the visible month changed (`layoutKey = dayKey(view)`) → `layout()` **rebuilds all `td`s** (6 rows × 7 per panel, via `replaceChildren`) so assistive tech announces the newly focused cell; otherwise `paint()` only patches class / `aria-selected` / `aria-disabled` / `aria-current` / `tabindex` (only writes when changed). Out-of-month cells are rendered `aria-hidden` and empty unless `showOtherMonths`. All-hidden rows get `aria-hidden`.
* Cells carry `data-k` (day key) and `aria-label` (full localized date). **Event delegation** on the root: `click` (cell → `pick`; `[data-a]` → prev/next/today/clear), `pointerover` (hover), `pointerleave`, `keydown` (Escape → `close`; Tab → `trapTab` over `button, input, td[tabindex="0"]`; Enter/Space → `pick`; arrows/Home/End/PageUp/PageDown via `keyboard.nextFocus`, Shift+Page = year, Left/Right mirrored in RTL).
* Prev/next use `aria-disabled` (never `disabled`) so focus is not lost at the limits. `nav()` moves `focus` by the same number of months as `view`.
* `ViewState.keys` holds selected day keys; `selected` styling/`aria-selected` = in `keys` **or** (`span` and not a hover preview and inside the span) — so a committed range's interior gets `.tp-selected` (accent) as well, which visually overrides `.tp-in-range` (a pre-existing look, see §11).

## 7. Feature deep-dives

### 7.1 Modes (`modes.ts`, `modules/range.ts`, `modules/multiple.ts`)
`Mode = { max, join, iso, autoClose, clean(dates), pick(current, day) → {sel, complete}, span?(keys, hover) }`.
* `single`: max 1, `autoClose` true. `range`: max 2, `join ' – '`, `iso '/'`, two clicks (order-free, sorted by `byDay`); `complete:false` after the first click ⇒ `pending`; `span` highlights start..end or start..hover. `multiple`: max ∞, toggles days, `autoClose` false, `complete` always true.
* `join` = separator in the *display text*, `iso` = separator in `isoInput`/WC `value`. `getDate()` returns a single value iff `mode.max === 1`.
* Adding a mode = implement `Mode`, `registerMode(name, mode)` at module top level, add a package export + tsup entry + `sideEffects` entry, and (for the WC) a loader in `XDatepicker.MODES`.

### 7.2 Typed input, format and parse (`format.ts`, `Datepicker.read`)
* `read(text)` order: **(1)** `parseValueList` (ISO dates/date-times and 9–11-digit timestamps — always accepted, unambiguous), **(2)** `parseDates(text, fmt, loc, time?)` (the display format).
* Formatting tokens: `yyyy yy MMMM MMM MM M dd d EEEE EEE`, `'literal'`. Month names in `MMMM/MMM` use the *in-date* form (genitive in Ukrainian: "5 березня"), parse accepts every form (in-date/standalone × long/short, plus custom `months`).
* Default format is derived per locale from `Intl.DateTimeFormat(...).formatToParts` with `numberingSystem: 'latn'` and `calendar: 'gregory'` → e.g. `dd.MM.yyyy` (uk), `MM/dd/yyyy` (en-US), `yyyy-MM-dd` (sv).
* `parseDates` builds a regex from the format: separators are lenient (`[^\p{L}\p{N}]*`; literals with letters become optional), weekday names optional (and require a trailing separator so "Mar" is not read as "Ma"+"r"), `yy` uses a +50-year pivot, eastern-Arabic/Persian digits are normalised, **leftover alphanumerics ⇒ invalid**, impossible dates (31.02) ⇒ `null`. It scans the whole text with `matchAll`, so a range/multiple text yields several dates ("05.03.2025 – 10.03.2025").
* With `time` (an `enableTime` picker) `parseDates` first lifts `HH:mm[:ss]` occurrences (`TIME` regex) out of the text; the i-th time pairs with the i-th date; no times ⇒ every date gets the picker's current `tod`; a count mismatch ⇒ invalid; `h>23, m>59, s>59` ⇒ invalid. Without `time`, a time in the text is invalid (unchanged legacy behaviour).
* Text shown in the input is `formatDate(d, fmt, loc)` plus `' ' + formatTime(d)` (always `HH:mm:ss`, not configurable) with `enableTime`, joined with `mode.join`.

### 7.3 Unix timestamps
Input: always understood (`parseUnix`, the 9–11 digit rule keeps `20250315` a date). Output: `outputTimestamp` ⇒ `toUnix(...)`. Date-only pickers normalise to a midnight (local, or UTC with `valueInUtc`), so timestamp→timestamp is *not* identity there; with `enableTime` it is exact (to the second). Milliseconds are dropped everywhere. 13-digit (ms) timestamps are **not** recognised.

### 7.4 Time selector (`enableTime`)
* **Split:** core owns the data model; `modules/time.ts` owns only the UI and registers it via `registerTimeUI(factory)`. `Calendar` builds `o.time?.({loc, cls, id, change})` and inserts `ui.el` between `.tp-months` and `.tp-foot`; `paint()` calls `ui.set(state.time)`.
* **UI:** three `<input type=text inputmode=numeric size=2 maxlength=2 role=spinbutton>` in `div.tp-time[role=group]` with `aria-label`s from `loc.strings` (`time/hours/minutes/seconds`, uk translated). Keys: digits; ArrowUp/Down wrap; Home/End = 0/max; Enter commits; `change`/blur clamps to range (NaN reverts). `set(t)` does not overwrite a field that has focus (compares `getRootNode().activeElement`; **do not** use `:focus` matching, jsdom crashes in shadow roots).
* **Semantics:** one `tod` for the whole picker. Picking a day → `stamp(day)` (copy with `setHours(...tod)`). Editing the selector → `setTime(t)`: `tod = t`; if a range pick is `pending` its dates are re-stamped and the view refreshed (does not cancel the pick), else `setSel(sel.map(stamp), true)` (fires `change`). Typed text with per-date times keeps them until the selector is touched. A date typed without a time takes `tod`.
* `closeOnSelect` default becomes `false` with `enableTime` (otherwise the popup would close before the time can be set); an explicit `closeOnSelect: true` still closes.
* **DST:** a non-existent local time (02:30 on 2025-03-09 in New York) is moved by JS to 03:30; `tod` follows via `timeOf(next[0])` and the input shows the normalised time.
* **Limits** are day-based; min/max/disabled don't constrain the time of day. Enabling/disabling `enableTime` at runtime adds `00:00:00` / drops the time (`setOptions` re-normalises `sel`).

### 7.5 `valueInUtc` — the UTC backend switch
Purpose (the user's words): backends that only speak UTC force every app to write local↔UTC conversion code; the picker should do it inside. **Values are UTC, display/edit is local.**
* **Date-only:** day ↔ UTC midnight. `selected: Date.UTC(2025,2,15)` shows "15 March" in every timezone; a picked day is reported as `2025-03-15T00:00:00.000Z` (without the flag a Kyiv user gets `2025-03-14T22:00:00.000Z`, the classic off-by-one-day). Timestamp UTC-midnight round-trips exactly in every zone. A mid-day UTC timestamp maps to its **UTC day**.
* **With `enableTime`:** `Date`/timestamps are already instants (no change). ISO strings become UTC: out `2025-03-15T11:07:09Z`; in: zone-less ⇒ UTC, `Z`/offset honoured, `.fff` accepted (`toISOString()` round-trips). A bare date string with time+utc ⇒ UTC midnight instant. The time selector and the input text stay local.
* Applies to *values only* (§5). Passing a local-midnight `new Date(2025,2,15)` with the flag is read as a UTC value (⇒ the 14th for users east of UTC) — documented in the README.
* `setOptions({valueInUtc})` keeps the displayed day/time and changes what is reported.
* The web component hands the raw `value` tokens (`split(/\s*[/,;]\s*/)`) to the picker so the picker converts them (the element itself must never pre-parse values).
* README has a verified table (Kyiv, UTC+2): date-only local `…14T22:00:00.000Z` / `1741989600`; date-only UTC `…15T00:00:00.000Z` / `1741996800`; 15 Mar 13:07:09 local → `1742036829`, UTC iso `2025-03-15T11:07:09Z`.

### 7.6 Localization (`localization.ts`)
`resolveLocale(input?: string | LocaleObject, firstDayOverride?)`:
* code = input tag or `navigator.language` or `'en'`; invalid tags fall back to `'en'` (probed with `new Intl.DateTimeFormat(code)`).
* `registerLocale(obj)` registry, looked up by lower-cased tag, then its language prefix (that is how `locale="uk"` finds `locales/uk`). A `LocaleObject` passed directly is used as is.
* UI strings: English defaults, overridden by the locale object; `today` is auto-localised with `Intl.RelativeTimeFormat(code,{numeric:'auto'}).format(0,'day')` (capitalised) unless overridden. Other strings stay English unless provided (known mixed-language edge).
* First weekday: `locale.firstDayOfWeek` → `Intl.Locale#getWeekInfo()/weekInfo` → region table `SUNDAY_REGIONS` fallback (Monday otherwise). Direction: `getTextInfo()/textInfo` → `RTL_LANGS` regex.
* `title(d)` ("March 2025"), `label(d)` (full a11y date), `dow(i, long?)` (0 = Sunday), `month(i, short?)`, `monthIndex(name)`, `num(n)` (locale digits for grid numbers), lazy `format` getter. Custom `months/weekdays` arrays bypass `Intl` for those names.
* Always Gregorian (`calendar: 'gregory'`) so `th`/`ar-SA` don't switch calendars.

### 7.7 Web component (`wc/XDatepicker.ts`)
* Shadow root (open, `delegatesFocus`): `<style>core+themes+LOCAL</style><div.wrap part=wrap><input part=input><button.toggle part=toggle>`. CSS arrives as text via tsup's `.css` text loader (hence `css.d.ts`); `LOCAL` styles the host/input/toggle. The input is boxed (border, radius, colours) from the `--tp-*` variables, which `core.css` / `themes.css` now also declare on `:host` (`:host([theme=dark])`, `:host(:not([theme=light]))` for the media query), because the input is a sibling of the popup, not inside `.tp-dp`. Page CSS (e.g. the demo's `input[type=text]` rule) never reaches the shadow input; that is why the demo's imperative inputs look boxed but the WC needed its own styles. Known gap: `theme` set only through `el.options` (not the attribute) styles the popup but not the input; and a page-level `--tp-*` on the host reaches only the input, as `.tp-dp` redeclares the variables. The popup is appended **into the shadow root** (`appendTo: root`, `anchor: wrap`) and the shadow-local bare `input{…}` rule also matches the time fields — they beat it with `.tp-dp .tp-time-field` (specificity).
* `ATTRS` maps attribute → `[option, parser]`; `opts()` = attributes merged with `extra` (the `options` setter). A missing attribute parses to `undefined` ⇒ default, and `setOptions({...prev, ...undefined})` deliberately resets it.
* **Async init:** `connectedCallback` → `ready = init()`: `await load(opts)` (dynamic `import()` of range/multiple/time as needed) then constructs the picker with `isoInput: this.iso` (a detached hidden `<input>` whose `.value` backs the `value` getter and the form value). A `gen` counter cancels init if the element was disconnected meanwhile. `disconnectedCallback` → `teardown()` (destroy). Re-attach re-inits.
* `attributeChangedCallback`: `placeholder/label/disabled` handled directly; others are ignored until a picker exists; `value` → `setValue` (`setDate(tokens)` then `syncForm`); `inline` → teardown + init; everything else → `apply()` (async: load modules then `picker.setOptions(opts())`; the *attribute change is therefore applied asynchronously* — tests/demo wait ~50 ms).
* Form association: `static formAssociated`, `attachInternals?.()`, `setFormValue?.()` (double-optional: jsdom has `attachInternals` without `setFormValue`). Value = `iso.value`. `formResetCallback` resets to the *current* `value` attribute.
* `Base` falls back to an empty class when `HTMLElement` is undefined (SSR import safety); `customElements.define` is guarded in `wc/index.ts`.

### 7.8 CSS and theming (`styles/`)
* Variables on `.tp-dp`: `--tp-bg --tp-fg --tp-muted --tp-border --tp-hover --tp-accent --tp-accent-fg --tp-range --tp-focus --tp-radius --tp-cell --tp-pad --tp-z --tp-shadow` (+ `--tp-font`). Dark via `.tp-dp[data-theme=dark]` and `@media (prefers-color-scheme: dark){.tp-dp:not([data-theme=light])}` (the variable block is duplicated on purpose). `forced-colors` handled for the selected day.
* `.tp-pop` = `position: fixed; z-index: var(--tp-z)`; `.tp-dp[hidden]{display:none}` is required because the class sets `display`.
* **Host-page leakage:** the popup lives in `<body>`, so the host's global `input[type=text]{width:100%…}` hits the time fields. Library rules for them are prefixed `.tp-dp` and the fields have `size=2`; the time row is a 5-column grid, `width:100%; max-width: calc(7*var(--tp-cell))`, centred (so with two months it stays one month wide). Keep any new internal form control equally defensive.
* **Input icon (`.tp-icon`):** an inline-SVG `background-image` on the bound `<input>` (no wrapper element, so the user's markup is untouched). It uses background *longhands* (the `background` shorthand would wipe the input's colour) and a doubled class `.tp-icon.tp-icon` so a page's `input[type=text]{background:…;padding:…}` cannot override it; `:dir(rtl)` mirrors the position. The class name is a constant in `Datepicker.ts`, not part of `ClassNames`. The stroke colour is fixed (`#7d8590`, readable on light and dark), as data URIs can't use CSS variables.
* `classes` option replaces entries of `CLASSES` (in `Calendar.ts`); if a user replaces `root` they lose the variables and must supply their own CSS. No `content-visibility` is used (considered, deliberately skipped).

## 8. Traps and gotchas learned the hard way

1. **`.map(formatISO)` / `.map(toDate)` pass the array index as the 2nd argument** — which is now the `time` flag (`formatISO(d, time, utc)`, `toDate(v, time, utc)`). Always use a lambda. (`list.map(toDate)` was a real bug I avoided; tests broke on `.map(formatISO)`.)
2. **Double conversion** of already-converted dates (§5 "must NOT").
3. **CRLF:** Python on Windows rewrites `\n` → `\r\n` when you `open(p,'w')` text files. Use `open(p,'rb')…write(bytes)` and assert `'\r\n' not in text`, or the Edit tool. After scripted edits run `grep -rlU $'\r' src demo README.md package.json` (must print nothing) and `git diff --stat` (a whole-file diff = line-ending damage; fix with `sed -i 's/\r$//'`).
4. **Unquoted bash heredocs expand `$(...)`/backticks** — never put JS selectors like `$('#a')` in `<<EOF`; use a quoted `<<'EOF'` or the Write tool. Git-Bash `/tmp` is not visible to Windows Python (`cygpath -w`).
5. **Windows Node ignores IANA names in the `TZ` env var at startup** (`TZ=America/New_York` silently stays in the machine zone; `TZ=UTC` and POSIX strings like `EST5EDT` do work). Assign `process.env.TZ` inside the process (preload, §9). I once reported multi-timezone passes that were not real.
6. **jsdom limits:** `matches(':focus-within')`/`:focus` crash inside shadow roots (dom-selector bug); no layout (`getBoundingClientRect` zeros); `ElementInternals.setFormValue` missing; Node's global `Event`/`EventTarget`/`CustomEvent` must be replaced by jsdom's or `dispatchEvent` throws.
7. **`outerHTML` does not serialise `.value` properties** — copy values to attributes before snapshotting markup for screenshots.
8. **tsx cannot import `.css`** (the WC does): copy `src` to a scratch dir and replace the two `import … from '…css'` lines with `const core = ''`.
9. **Demo file is Prettier-formatted by the user**: read the current text before editing; regex/replace with exact strings and `assert count == 1`.
10. **Web component attribute changes are async** (`apply()` awaits module loading): in the demo/tests wait ~50 ms before reading derived state.
11. `Calendar.layout()` creates new `td`s on month change — a held reference to a cell is stale after navigation. Focus is re-applied via `focusTd` in `paint()`.
12. `setSel` does not `reveal`; if you add a caller that changes the selection from outside the visible month, reveal first.
13. IDE diagnostics (`unused import`, `Cannot find name`) appear transiently *between* multi-step edits; judge only the final `tsc --noEmit`.

## 9. Testing

**There is no test suite in the repo** (no test framework in `devDependencies`, no `tests/` dir; this was never requested). All verification so far was done with throw-away scripts in the session scratchpad (`C:\Users\tenpr\AppData\Local\Temp\claude\…\scratchpad`, temporary — assume it is gone). Standard check in the repo: `npm run typecheck`.

If asked to (re)build tests, this is the recipe that worked (Node 22, Windows, Git Bash):
* Dev-only deps outside the repo (or add `vitest`/`jsdom` if the user agrees): `jsdom`, `tsx`. Test files are ESM `.mts` (top-level `await`); import absolute paths as `file:///D:/…` or relative to a scratch copy of `src`.
* **Harness shims** (before importing the library): create `new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/' })`; force-define on `globalThis`: `window, document, HTMLElement, HTMLInputElement, Event, EventTarget, CustomEvent, KeyboardEvent, MouseEvent, Node, customElements, ShadowRoot, navigator` (+`FormData` for the demo); patch `Element.prototype.matches` to emulate `:focus-within` from `getRootNode().activeElement` (`this.contains(active)`); simulate user clicks on inputs with `el.focus()` first (a real click focuses the input; `opener` logic depends on it).
* **Time zones:** `tz.mjs` = `if (process.env.TZZ) process.env.TZ = process.env.TZZ;` (no `console.log` — it breaks tsx), run `TZZ=Pacific/Kiritimati NODE_OPTIONS="--import file:///…/tz.mjs" npx tsx x.test.mts`. Matrix I used: America/New_York, Pacific/Honolulu, Pacific/Auckland, Pacific/Kiritimati (+14), America/Sao_Paulo, Europe/Kyiv, Asia/Kolkata (+5:30), America/St_Johns (−2:30/−3:30), UTC. DST-gap case: `09/03/2025 02:30:00` in New York.
* **Suites I had (all passed at b5396cc):** pure (format/parse/localization/Day, ~50 checks); timestamps (4 combinations, ranges, WC); DOM behaviour (open/keyboard/typing/limits/range preview/multiple/inline/destroy, ~80); web component (lazy modes, shadow popup, attrs, form value, reconnect); time (selector UI, parsing, range/multiple, runtime toggle, DST, WC); UTC (date-only identical in every zone, ISO zones, selector in local→UTC, WC); a script that runs the **demo page's real `<script>`** against `src` (imports rewritten) and drives the backend field; and a check that prints every number in the README's UTC table.
* **Visual CSS check without building:** generate the popup markup in jsdom, write a static HTML (demo `<style>` + `core.css` + `themes.css` + the markup, `data-theme=dark`), screenshot with `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=330,520 --screenshot=out.png file:///…html`, and `Read` the PNG. Chrome is also installed.
* Things never tested for real: pointer hover previews in a browser, positioning/flip/scroll, focus behaviour of actual browsers (Safari doesn't focus buttons on click), AT announcements, touch/mobile keyboards.

## 10. Build, packaging, size

* `npm run build` = `tsup` (`format: ['esm']`, `target: es2020`, `splitting: true`, `minify`, `dts`, `clean`, `loader {'.css':'text'}`; `onSuccess` copies `core.css`/`themes.css` into `dist/`). Entries: `index`, `range`, `multiple`, `time`, `wc`, `locales/uk`. **ESM-only is required**: the mode/time/locale registries must be shared between entries, which needs the shared chunks (observed: `index.js` re-exports from `chunk-*.js`; `range.js`/`time.js` import the registry chunks). `npm run demo` = build + `npx serve . -l 5173` → `http://localhost:5173/demo/`.
* The WC dynamically `import()`s `../modules/range|multiple|time`, which esbuild resolves to the entry files — keep those paths and entry names aligned.
* Pre-publish checklist (user runs `npm publish`): `typecheck`, `build`, inspect `npm pack --dry-run` (only `dist`, `README.md`, `LICENSE`, `package.json`), check the name is free (`npm view ten-protons-datepicker`), decide the version (currently `0.1.0`; the original spec said "Version 1"), confirm the MIT holder name, consider adding `repository`/`homepage`/`bugs` fields (absent), and size-check against the spec (§1).
* Measuring size without rebuilding: `cat dist/index.js dist/chunk-*.js | gzip -9 | wc -c` (add `range.js`/`time.js` for the combos).

## 11. Known limitations and open items

* **Core is ~8.9 KB gz vs the 7.5 KB goal.** Candidates: caching/removing `Intl` helpers, simplifying `parseDates`, dropping rarely-needed paths, moving timestamp/UTC parsing behind a module. Measure before/after.
* No tests in the repo; no CI.
* Spec items not done: presets module, year-month view, a built-in "inline" module split (inline lives in core), CJS.
* `DatepickerOptions.outputTimestamp` JSDoc still says "local midnight" and does not mention `valueInUtc`; `DateInput` JSDoc mentions only `yyyy-MM-dd` although date-times/zones are accepted; `jumpToDate(date: Date)` is typed `Date` but accepts any `DateInput` at runtime. (Doc debt, harmless.)
* Time selector: `HH:mm:ss` only; one shared time in range/multiple; day-based min/max; new picks default to `00:00:00` (not "now"); "Today" picks the **local** today even with `valueInUtc`.
* Range interior cells use `.tp-selected` (accent) rather than the lighter `.tp-in-range`; may deserve a design pass.
* `parseDates` rebuilds its regex on every call (no caching); fine for typed input.
* UI strings other than `today` default to English for every locale except `uk` (mixed-language UI for e.g. `fr` unless the user passes strings).
* WC: `value` setter writes the attribute, so form reset returns to the last assigned value, not the original; `attributeChangedCallback` for most options is asynchronous.
* The WC `name` attribute is only used by form association (needs `ElementInternals`, Safari 16.4+); older browsers do not submit it.
* Millisecond timestamps (13 digits) are rejected as invalid text.
* Accessibility is implemented to the WAI-ARIA pattern but **never tested with a screen reader**.
* SSR: modules import safely (guards for `HTMLElement`), but constructing a `Datepicker` needs a DOM.

## 12. Decision log

* **ESM-only, single package with subpath exports** instead of a monorepo — simplest publishing; modules tree-shake by import.
* **Optional features self-register** (modes, time UI, locales) so core pays nothing for them; the cost is import-time side effects (`sideEffects` whitelist).
* **Calendar rebuilds day cells on month change** (not in-place updates) for screen-reader announcement; selection/hover only patches attributes.
* **Open on click without stealing focus** when typing is allowed; keyboard open moves focus in.
* **Date format is token based, not `Intl` options** (parse needs a deterministic pattern); default pattern is derived from `Intl` so it stays locale-correct.
* **Timestamps are seconds, 9–11 digits** so `yyyyMMdd` can never be mistaken for one; ms not supported.
* **`outputTimestamp` changes the returned *type*** (explicitly requested by the user); `DatepickerValue` was widened rather than making the class generic.
* **Time selector is a module + registry**, `closeOnSelect` defaults off with time, one shared `tod`.
* **`valueInUtc` converts at one boundary (`Day.ts`)** and means "values are UTC" (not "display UTC"). Name chosen to be self-explanatory; alternatives considered: `utc`, `convertUtcToLocal`.
* **HH:mm:ss display is fixed** (user said "by default"; no `timeFormat` option was requested).
* **`.tp-dp`-prefixed selectors for form controls** inside the popup to survive aggressive host CSS.

## 13. History

`a885269` project instructions → `dc5e197` first step (core, range, multiple, wc, README) → demo page → backend-emulation field in the demo → `a3e1811` timestamp convert (`outputTimestamp`, always-on timestamp input) → `2eff653` time picker (`enableTime`, `modules/time.ts`, `core/time.ts`) → `184f288` fix styles (time row width/specificity) → `b5396cc` `valueInUtc`. The package was renamed from `@ten-protons/datepicker` to `ten-protons-datepicker` (scoped names need `@scope/name`).
