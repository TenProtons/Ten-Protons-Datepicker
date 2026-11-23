export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k in attrs) e.setAttribute(k, attrs[k]!);
  return e;
};
export const cx = (...a: Array<string | false | null | undefined>): string => a.filter(Boolean).join(' ');
/** Writes an attribute only when it changes (`null` removes it). */
export const attr = (e: Element, name: string, v: string | null): void => {
  if (e.getAttribute(name) !== v) v === null ? e.removeAttribute(name) : e.setAttribute(name, v);
};
