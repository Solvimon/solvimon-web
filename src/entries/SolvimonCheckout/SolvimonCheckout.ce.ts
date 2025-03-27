import { defineCustomElement } from '@/utils/customElements';
import SolvimonCheckoutVue from './SolvimonCheckout.vue';
import { COMPONENT_TAG_PREFIX } from '../../constants';

const COMPONENT_NAME = `${COMPONENT_TAG_PREFIX}checkout`;

export const SolvimonCheckout = defineCustomElement(SolvimonCheckoutVue);
export const defineSolvimonCheckout = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonCheckout);
    }
}