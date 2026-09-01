import SolvimonCustomerPaymentMethodsVue from './CustomerPaymentMethods.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonCustomerPaymentMethods } = createSolvimonElement(
    SolvimonCustomerPaymentMethodsVue,
    'customer-payment-methods',
);
