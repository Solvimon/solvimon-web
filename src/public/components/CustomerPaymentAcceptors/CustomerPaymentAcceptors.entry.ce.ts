import CustomerPaymentAcceptorsVue from './CustomerPaymentAcceptors.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export type { SolvimonCustomerPaymentAcceptorsEntryProps } from './CustomerPaymentAcceptors.entry.types';
export type { PaymentAcceptorsConfiguration } from '@/public/types/paymentAcceptors';

export const { define: defineSolvimonCustomerPaymentAcceptors } = createSolvimonElement(
    CustomerPaymentAcceptorsVue,
    'customer-payment-acceptors',
);
