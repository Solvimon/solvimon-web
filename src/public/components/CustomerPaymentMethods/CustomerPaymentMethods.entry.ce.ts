import SolvimonCustomerPaymentMethodsVue from './CustomerPaymentMethods.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonCustomerPaymentMethods = defineCustomElement(
    SolvimonCustomerPaymentMethodsVue,
);
export const COMPONENT_NAME = getComponentName('customer-payment-methods');

export const defineSolvimonCustomerPaymentMethods = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCustomerPaymentMethods);
    }
};
