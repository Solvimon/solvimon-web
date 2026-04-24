import BillingInformationFormVue from './BillingInformationForm.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonBillingInformationForm = defineCustomElement(BillingInformationFormVue);
export const COMPONENT_NAME = getComponentName('billing-information-form');

export const defineSolvimonBillingInformationForm = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonBillingInformationForm);
    }
};
