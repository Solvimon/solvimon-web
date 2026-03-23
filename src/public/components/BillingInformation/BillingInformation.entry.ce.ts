import BillingInformationVue from './BillingInformation.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonBillingInformation = defineCustomElement(BillingInformationVue);

export const COMPONENT_NAME = getComponentName('billing-information');

export const defineSolvimonBillingInformation = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonBillingInformation);
    }
};
