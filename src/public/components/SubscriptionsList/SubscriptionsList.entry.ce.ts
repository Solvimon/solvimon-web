import SubscriptionsListVue from './SubscriptionsList.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonSubscriptionsList = defineCustomElement(SubscriptionsListVue);
export const COMPONENT_NAME = getComponentName('subscriptions-list');

export const defineSolvimonSubscriptionsList = (): void => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonSubscriptionsList);
    }
};
