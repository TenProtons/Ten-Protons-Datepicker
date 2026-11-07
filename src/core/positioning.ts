import type { Position } from './types';

const GAP = 4;
const PAD = 8;

/** Places a `position: fixed` popup next to `anchor`, keeping it inside the viewport. */
export const place = (anchor: HTMLElement, pop: HTMLElement, position: Position, rtl: boolean): void => {
  const a = anchor.getBoundingClientRect();
  const [w, h] = [pop.offsetWidth, pop.offsetHeight];
  const [vw, vh] = [document.documentElement.clientWidth, document.documentElement.clientHeight];
  const fit = (v: number, size: number, max: number) => Math.max(PAD, Math.min(v, max - size - PAD));

  let x = rtl ? a.right - w : a.left; // align the inline-start edges
  let y: number;
  if (position === 'left' || position === 'right') {
    x = position === 'left' ? a.left - w - GAP : a.right + GAP;
    y = a.top;
  } else {
    const above = position === 'top' || (position === 'auto' && vh - a.bottom < h + GAP && a.top > vh - a.bottom);
    y = above ? a.top - h - GAP : a.bottom + GAP;
  }
  pop.style.left = `${fit(x, w, vw)}px`;
  pop.style.top = `${fit(y, h, vh)}px`;
};
