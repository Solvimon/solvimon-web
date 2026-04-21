import PaymentHistoryVue from './PaymentHistory.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonPaymentHistory = defineCustomElement(PaymentHistoryVue);
export const COMPONENT_NAME = getComponentName('payment-history');

export const defineSolvimonPaymentHistory = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonPaymentHistory);
    }
};
