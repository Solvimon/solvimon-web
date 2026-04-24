import PaymentMethodFormVue from './PaymentMethodForm.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonPaymentMethodForm = defineCustomElement(PaymentMethodFormVue);
export const COMPONENT_NAME = getComponentName('payment-method-form');

export const defineSolvimonPaymentMethodForm = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonPaymentMethodForm);
    }
};
