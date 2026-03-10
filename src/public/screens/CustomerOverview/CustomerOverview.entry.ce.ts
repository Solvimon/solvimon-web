import SolvimonCustomerOverviewVue from './CustomerOverview.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonCustomerOverview = defineCustomElement(SolvimonCustomerOverviewVue);
export const COMPONENT_NAME = getComponentName('customer-overview');

export const defineSolvimonCustomerOverview = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCustomerOverview);
    }
};
