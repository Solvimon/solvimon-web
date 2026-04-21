import InvoiceVue from './Invoice.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonInvoice = defineCustomElement(InvoiceVue);
export const COMPONENT_NAME = getComponentName('invoice');

export const defineSolvimonInvoice = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoice);
    }
};
