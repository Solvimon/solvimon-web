import SubscriptionSchedulesVue from './SubscriptionSchedules.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonSubscriptionSchedules = defineCustomElement(SubscriptionSchedulesVue);
export const COMPONENT_NAME = getComponentName('subscription-schedules');

export const defineSolvimonSubscriptionSchedules = (): void => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonSubscriptionSchedules);
    }
};
