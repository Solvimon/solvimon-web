import SolvimonPaymentMethodsManagementVue from './PaymentMethodsManagement.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonPaymentMethodsManagement } = createSolvimonElement(
    SolvimonPaymentMethodsManagementVue,
    'payment-methods-management',
);
