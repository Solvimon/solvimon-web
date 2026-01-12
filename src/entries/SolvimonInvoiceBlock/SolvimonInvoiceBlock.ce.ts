import SolvimonInvoiceBlockVue from './SolvimonInvoiceBlock.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonInvoiceBlock = defineCustomElement(SolvimonInvoiceBlockVue);
export const COMPONENT_NAME = getComponentName('invoice-block');

export const defineSolvimonInvoiceBlock = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoiceBlock);
    }
};
