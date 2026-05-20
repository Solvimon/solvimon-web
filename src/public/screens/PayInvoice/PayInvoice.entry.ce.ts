import SolvimonPayInvoiceVue from './PayInvoice.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonPayInvoice = defineCustomElement(SolvimonPayInvoiceVue);
export const COMPONENT_NAME = getComponentName('pay-invoice');

export const defineSolvimonPayInvoice = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonPayInvoice);
    }
};
