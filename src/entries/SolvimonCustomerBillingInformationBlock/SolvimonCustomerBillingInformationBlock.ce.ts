import SolvimonCustomerBillingInformationBlockVue from './SolvimonCustomerBillingInformationBlock.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonCustomerBillingInformationBlock = defineCustomElement(
    SolvimonCustomerBillingInformationBlockVue,
);

export const COMPONENT_NAME = getComponentName('customer-billing-information-block');

export const defineSolvimonCustomerBillingInformationBlock = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCustomerBillingInformationBlock);
    }
};
