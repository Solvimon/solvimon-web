import SolvimonInvoiceDetailsBlockVue from './SolvimonInvoiceDetailsBlock.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonInvoiceDetailsBlock =
    defineCustomElement(SolvimonInvoiceDetailsBlockVue);
const COMPONENT_NAME = getComponentName('invoice-details-block');

export const defineSolvimonInvoiceDetailsBlock = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoiceDetailsBlock);
    }
};
