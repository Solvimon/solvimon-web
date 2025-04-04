import SolvimonAddPaymentMethodFormVue from './SolvimonAddPaymentMethodForm.vue';
import { defineCustomElement } from '@/utils/customElements';
import { COMPONENT_TAG_PREFIX } from '@/constants';

export const SolvimonAddPaymentMethodForm = defineCustomElement(SolvimonAddPaymentMethodFormVue);
const COMPONENT_NAME = `${COMPONENT_TAG_PREFIX}add-payment-method-form`;

export const defineSolvimonAddPaymentMethodForm = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonAddPaymentMethodForm);
    }
};
