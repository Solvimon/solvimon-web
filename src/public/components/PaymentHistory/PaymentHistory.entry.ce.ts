import PaymentHistoryVue from './PaymentHistory.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonPaymentHistory,
    componentName: COMPONENT_NAME,
    define: defineSolvimonPaymentHistory,
} = createSolvimonElement(PaymentHistoryVue, 'payment-history');
