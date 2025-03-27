import { defineCustomElement } from '@/utils/customElements';
import SolvimonInvoiceVue from './SolvimonInvoice.ce.vue';
import { COMPONENT_TAG_PREFIX } from '../../constants';

const COMPONENT_NAME = `${COMPONENT_TAG_PREFIX}invoice`;

export const SolvimonInvoice = defineCustomElement(SolvimonInvoiceVue);
export const defineSolvimonInvoice = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonInvoice);
    }
}