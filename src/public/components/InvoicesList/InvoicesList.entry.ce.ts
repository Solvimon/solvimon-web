import SolvimonInvoicesListVue from './InvoicesList.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonInvoicesList = defineCustomElement(SolvimonInvoicesListVue);
export const COMPONENT_NAME = getComponentName('invoices-list');

export const defineSolvimonInvoicesList = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoicesList);
    }
};
