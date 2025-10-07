import SolvimonPaymentHistoryBlockVue from './SolvimonPaymentHistoryBlock.vue';
import { getComponentName } from '@/utils/component';
import { defineCustomElement } from '@/utils/customElements';

export const SolvimonPaymentHistoryBlock = defineCustomElement(SolvimonPaymentHistoryBlockVue);
export const COMPONENT_NAME = getComponentName('payment-history-block');

export const defineSolvimonPaymentHistoryBlock = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonPaymentHistoryBlock);
    }
};
