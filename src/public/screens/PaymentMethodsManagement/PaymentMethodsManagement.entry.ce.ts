import SolvimonPaymentMethodsManagementVue from './PaymentMethodsManagement.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonPaymentMethodsManagement = defineCustomElement(SolvimonPaymentMethodsManagementVue);
export const COMPONENT_NAME = getComponentName('payment-methods-management');

export const defineSolvimonPaymentMethodsManagement = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonPaymentMethodsManagement);
    }
};
