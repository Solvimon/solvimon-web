import SolvimonCustomerSubscriptionBlockVue from './SolvimonCustomerSubscriptionBlock.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonCustomerSubscriptionBlock =
    defineCustomElement(SolvimonCustomerSubscriptionBlockVue);
const COMPONENT_NAME = getComponentName('customer-subscription-block');

export const defineSolvimonCustomerSubscriptionBlock = (): void => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCustomerSubscriptionBlock);
    }
};
