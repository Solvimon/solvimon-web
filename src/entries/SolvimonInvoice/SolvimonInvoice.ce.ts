import SolvimonInvoiceVue from './SolvimonInvoice.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonInvoice = defineCustomElement(SolvimonInvoiceVue);
export const COMPONENT_NAME = getComponentName('invoice');

export const defineSolvimonInvoice = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoice);
    }
};
