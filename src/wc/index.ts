import { XDatepicker } from './XDatepicker';

if (typeof customElements !== 'undefined' && !customElements.get('x-datepicker')) {
  customElements.define('x-datepicker', XDatepicker);
}

export { XDatepicker };
