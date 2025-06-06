import SolvimonAddPaymentMethodFormVue from './SolvimonAddPaymentMethodForm.vue';
import { getComponentName } from '@/utils/component';
import { defineCustomElement } from '@/utils/customElements';

export * from './SolvimonAddPaymentMethodForm.types';

export const SolvimonAddPaymentMethodForm = defineCustomElement(SolvimonAddPaymentMethodFormVue);
export const COMPONENT_NAME = getComponentName('add-payment-method-form');

export const defineSolvimonAddPaymentMethodForm = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonAddPaymentMethodForm);
    }
};
