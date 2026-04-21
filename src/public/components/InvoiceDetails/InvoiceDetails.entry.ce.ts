import InvoiceDetailsVue from './InvoiceDetails.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonInvoiceDetails = defineCustomElement(InvoiceDetailsVue);
export const COMPONENT_NAME = getComponentName('invoice-details');

export const defineSolvimonInvoiceDetails = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoiceDetails);
    }
};
