import SolvimonInvoiceVue from './SolvimonInvoice.vue';
import { defineCustomElement } from '@/utils/customElements';
import { COMPONENT_TAG_PREFIX } from '@/constants';

export const SolvimonInvoice = defineCustomElement(SolvimonInvoiceVue);
const COMPONENT_NAME = `${COMPONENT_TAG_PREFIX}invoice`;

export const defineSolvimonInvoice = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoice);
    }
};
