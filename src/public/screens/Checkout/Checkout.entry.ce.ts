import SolvimonCheckoutVue from './Checkout.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonCheckout } = createSolvimonElement(
    SolvimonCheckoutVue,
    'checkout',
);
