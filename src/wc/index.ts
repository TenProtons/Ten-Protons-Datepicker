import { XDatepicker } from './XDatepicker';

// `x-datepicker` is generic and may be taken by another library; `ten-protons-datepicker` is the collision-proof name.
// A class can only be defined once, hence the subclass.
const TAGS = { 'ten-protons-datepicker': class extends XDatepicker {}, 'x-datepicker': XDatepicker };

if (typeof customElements !== 'undefined') {
  for (const [tag, element] of Object.entries(TAGS)) if (!customElements.get(tag)) customElements.define(tag, element);
}

export { XDatepicker };
