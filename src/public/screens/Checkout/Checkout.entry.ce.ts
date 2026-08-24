import SolvimonCheckoutVue from './Checkout.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonCheckout,
    componentName: COMPONENT_NAME,
    define: defineSolvimonCheckout,
} = createSolvimonElement(SolvimonCheckoutVue, 'checkout');
