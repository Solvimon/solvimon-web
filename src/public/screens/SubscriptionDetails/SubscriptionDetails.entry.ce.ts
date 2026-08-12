import SolvimonSubscriptionDetailsVue from './SubscriptionDetails.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonSubscriptionDetails = defineCustomElement(SolvimonSubscriptionDetailsVue);
export const COMPONENT_NAME = getComponentName('subscription-details');

export const defineSolvimonSubscriptionDetails = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonSubscriptionDetails);
    }
};
