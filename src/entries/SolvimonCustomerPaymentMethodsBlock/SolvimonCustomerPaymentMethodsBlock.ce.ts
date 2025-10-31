import SolvimonCustomerPaymentMethodsBlockVue from './SolvimonCustomerPaymentMethodsBlock.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonCustomerPaymentMethodsBlock = defineCustomElement(
    SolvimonCustomerPaymentMethodsBlockVue,
);
const COMPONENT_NAME = getComponentName('customer-payment-methods-block');

export const defineSolvimonCustomerPaymentMethodsBlock = (): void => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCustomerPaymentMethodsBlock);
    }
};
