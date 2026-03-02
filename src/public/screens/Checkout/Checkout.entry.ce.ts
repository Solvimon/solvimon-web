import SolvimonCheckoutVue from './Checkout.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonCheckout = defineCustomElement(SolvimonCheckoutVue);
export const COMPONENT_NAME = getComponentName('checkout');

export const defineSolvimonCheckout = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCheckout);
    }
};
