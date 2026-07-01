import InvoiceHeaderVue from './InvoiceHeader.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonInvoiceHeader = defineCustomElement(InvoiceHeaderVue);
export const COMPONENT_NAME = getComponentName('invoice-header');

export const defineSolvimonInvoiceHeader = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoiceHeader);
    }
};
