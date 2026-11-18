import SolvimonPaymentAcceptorsManagementVue from './PaymentAcceptorsManagement.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonPaymentAcceptorsManagement } = createSolvimonElement(
    SolvimonPaymentAcceptorsManagementVue,
    'payment-acceptors-management',
);
