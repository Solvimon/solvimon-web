import { defineCustomElement } from '@/utils/customElements';
import SolvimonCheckoutVue from './SolvimonCheckout.vue';
import { COMPONENT_TAG_PREFIX } from '../../constants';

const SolvimonCheckout = defineCustomElement(SolvimonCheckoutVue);
const COMPONENT_NAME = `${COMPONENT_TAG_PREFIX}checkout`;

if (!customElements.get(COMPONENT_NAME)) {
    customElements.define(COMPONENT_NAME, SolvimonCheckout)
}