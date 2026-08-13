import SolvimonSubscriptionManagementVue from './SubscriptionManagement.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonSubscriptionManagement = defineCustomElement(
    SolvimonSubscriptionManagementVue,
);
export const COMPONENT_NAME = getComponentName('subscription-management');

export const defineSolvimonSubscriptionManagement = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonSubscriptionManagement);
    }
};
