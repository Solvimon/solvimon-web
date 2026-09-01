import PaymentHistoryVue from './PaymentHistory.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonPaymentHistory } = createSolvimonElement(
    PaymentHistoryVue,
    'payment-history',
);
