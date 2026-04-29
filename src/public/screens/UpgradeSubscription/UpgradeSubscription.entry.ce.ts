import SolvimonUpgradeSubscriptionVue from './UpgradeSubscription.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonUpgradeSubscription = defineCustomElement(SolvimonUpgradeSubscriptionVue);
export const COMPONENT_NAME = getComponentName('upgrade-subscription');

export const defineSolvimonUpgradeSubscription = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonUpgradeSubscription);
    }
};
