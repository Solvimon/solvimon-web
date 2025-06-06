import SolvimonCheckoutVue from './SolvimonCheckout.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonCheckout = defineCustomElement(SolvimonCheckoutVue);
const COMPONENT_NAME = getComponentName('checkout');

export const defineSolvimonCheckout = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCheckout);
    }
};
