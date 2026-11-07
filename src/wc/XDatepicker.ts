import { Datepicker } from '../core/Datepicker';
import { parseISOList } from '../core/Day';
import type { DatepickerEventMap, DatepickerOptions } from '../core/types';
import core from '../styles/core.css';
import themes from '../styles/themes.css';

// Extra modes load on demand, so `<x-datepicker mode="range">` costs nothing for single-date pages.
const MODES: Record<string, () => Promise<unknown>> = {
  range: () => import('../modules/range'),
  multiple: () => import('../modules/multiple'),
};

const str = (v: string | null) => v ?? undefined;
const num = (v: string | null) => (v === null ? undefined : Number(v));
const bool = (v: string | null) => (v === null ? undefined : v !== 'false');
const list = (v: string | null) => (v === null ? undefined : v.split(',').map(Number));

/** attribute -> [option, parser]. A missing attribute parses to `undefined`, i.e. the default. */
const ATTRS: Record<string, [keyof DatepickerOptions, (v: string | null) => unknown]> = {
  mode: ['mode', str],
  locale: ['locale', str],
  min: ['minDate', str],
  max: ['maxDate', str],
  'date-format': ['dateFormat', str],
  'first-day': ['firstDayOfWeek', num],
  position: ['position', str],
  theme: ['theme', str],
  'number-of-months': ['numberOfMonths', num],
  'show-other-months': ['showOtherMonths', bool],
  'allow-input': ['allowInput', bool],
  'close-on-select': ['closeOnSelect', bool],
  'disabled-days': ['disabledDaysOfWeek', list],
  inline: ['inline', bool],
};
const EVENTS = ['change', 'open', 'close', 'monthChange', 'yearChange'] as const;

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
const LOCAL = `:host{display:inline-block}:host([hidden]){display:none}.wrap{position:relative;display:flex;align-items:center}input{box-sizing:border-box;width:100%;padding-inline-end:2.25rem;font:inherit}.toggle{position:absolute;inset-inline-end:.25rem;display:grid;place-items:center;width:1.75rem;height:1.75rem;padding:0;border:0;border-radius:.25rem;background:none;color:inherit;cursor:pointer}.toggle:disabled{opacity:.4;cursor:default}:host([inline]) .toggle{display:none}`;

const Base: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as typeof HTMLElement) : HTMLElement;

/**
 * `<x-datepicker>`: an input + calendar toggle with the popup inside its shadow root.
 *
 * Attributes: `value` (ISO, ranges `a/b`, multiple `a,b`), `name`, `placeholder`, `label`, `disabled`,
 * `mode`, `locale`, `min`, `max`, `date-format`, `first-day`, `position`, `theme`, `number-of-months`,
 * `show-other-months`, `allow-input`, `close-on-select`, `disabled-days`, `inline`.
 * Events (bubbling, composed): `change`, `open`, `close`, `monthChange`, `yearChange` with `detail`.
 * Style with `::part(input)`, `::part(toggle)` and the `--tp-*` custom properties.
 * Takes part in forms (via `ElementInternals`) in browsers that support form-associated elements.
 */
export class XDatepicker extends Base {
  static formAssociated = true;
  static observedAttributes = [...Object.keys(ATTRS), 'value', 'placeholder', 'label', 'disabled'];

  /** Resolves with the underlying picker once it exists (extra modes load asynchronously). */
  ready: Promise<Datepicker | null> = Promise.resolve(null);

  private picker: Datepicker | null = null;
  private extra: DatepickerOptions = {};
  private gen = 0;
  private readonly internals = (this as unknown as HTMLElement).attachInternals?.();
  private readonly root: ShadowRoot;
  private readonly wrap: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly iso: HTMLInputElement;

  constructor() {
    super();
    const root = (this.root = this.attachShadow({ mode: 'open', delegatesFocus: true }));
    root.innerHTML = `<style>${core}${themes}${LOCAL}</style><div class="wrap" part="wrap"><input part="input"><button type="button" class="toggle" part="toggle" aria-haspopup="dialog">${ICON}</button></div>`;
    this.wrap = root.querySelector<HTMLElement>('.wrap')!;
    this.input = root.querySelector('input')!;
    this.toggleBtn = root.querySelector('button')!;
    this.iso = document.createElement('input'); // never attached: it just holds the ISO value
    this.toggleBtn.addEventListener('click', () => this.picker?.toggle());
  }

  /** ISO value: `2025-03-05`, `2025-03-01/2025-03-10` (range) or `2025-03-01,2025-03-05` (multiple). */
  get value(): string {
    return this.iso.value;
  }
  set value(v: string) {
    this.setAttribute('value', v);
  }

  /** Options that can't be expressed as attributes (callbacks, `disabledDates`, a `LocaleObject`...). */
  set options(o: DatepickerOptions) {
    this.extra = { ...this.extra, ...o };
    void this.apply();
  }

  open(): void {
    this.picker?.open();
  }
  close(): void {
    this.picker?.close();
  }
  toggle(): void {
    this.picker?.toggle();
  }

  connectedCallback(): void {
    this.ready = this.init();
  }

  disconnectedCallback(): void {
    this.teardown();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'placeholder') this.input.placeholder = value ?? '';
    else if (name === 'label') value === null ? this.input.removeAttribute('aria-label') : this.input.setAttribute('aria-label', value);
    else if (name === 'disabled') this.setDisabled(value !== null);
    else if (!this.picker) return; // everything else is read on connect
    else if (name === 'value') this.setValue(value);
    else if (name === 'inline') {
      this.teardown();
      this.ready = this.init();
    } else void this.apply();
  }

  formResetCallback(): void {
    this.setValue(this.getAttribute('value'));
  }

  formDisabledCallback(disabled: boolean): void {
    this.setDisabled(disabled);
  }

  private opts(): DatepickerOptions {
    const o: Record<string, unknown> = {};
    for (const [attr, [key, parse]] of Object.entries(ATTRS)) o[key] = parse(this.getAttribute(attr));
    return { ...o, ...this.extra };
  }

  private async load(mode?: string): Promise<void> {
    if (mode && MODES[mode]) await MODES[mode]!();
  }

  private async init(): Promise<Datepicker | null> {
    if (this.picker) return this.picker;
    const gen = ++this.gen;
    await this.load(this.opts().mode);
    if (gen !== this.gen || !this.isConnected) return null; // disconnected while the mode loaded

    const attrValue = this.getAttribute('value');
    const picker = (this.picker = new Datepicker(this.input, {
      ...this.opts(),
      selected: attrValue ? parseISOList(attrValue) : null,
      isoInput: this.iso,
      anchor: this.wrap,
      appendTo: this.root,
    }));
    for (const type of EVENTS) {
      picker.addEventListener(type, (e) => {
        if (type === 'change') this.syncForm();
        this.dispatchEvent(new CustomEvent(type, { detail: (e as DatepickerEventMap[typeof type]).detail, bubbles: true, composed: true }));
      });
    }
    this.toggleBtn.setAttribute('aria-label', picker.strings.label);
    this.setDisabled(this.hasAttribute('disabled'));
    this.syncForm();
    return picker;
  }

  private teardown(): void {
    this.gen++;
    this.picker?.destroy();
    this.picker = null;
  }

  private async apply(): Promise<void> {
    const opts = this.opts();
    await this.load(opts.mode);
    if (!this.picker) return;
    this.picker.setOptions(opts);
    this.toggleBtn.setAttribute('aria-label', this.picker.strings.label);
  }

  private setValue(v: string | null): void {
    this.picker?.setDate(v ? (parseISOList(v) ?? []) : []);
    this.syncForm();
  }

  private setDisabled(disabled: boolean): void {
    this.input.disabled = this.toggleBtn.disabled = disabled;
    if (disabled) this.picker?.close();
  }

  private syncForm(): void {
    this.internals?.setFormValue?.(this.iso.value || null);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'x-datepicker': XDatepicker;
  }
}
