import SolvimonCheckoutSessionVue from './CheckoutSession.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonCheckoutSession } = createSolvimonElement(
    SolvimonCheckoutSessionVue,
    'checkout-session',
);
