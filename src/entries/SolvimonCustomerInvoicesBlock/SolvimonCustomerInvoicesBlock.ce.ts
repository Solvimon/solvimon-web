import SolvimonCustomerInvoicesBlockVue from './SolvimonCustomerInvoicesBlock.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonCustomerInvoicesBlock =
    defineCustomElement(SolvimonCustomerInvoicesBlockVue);
const COMPONENT_NAME = getComponentName('customer-invoices-block');

export const defineSolvimonCustomerInvoicesBlock = (): void => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCustomerInvoicesBlock);
    }
};
