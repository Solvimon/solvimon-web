import SolvimonPaymentMethodsManagementVue from './PaymentMethodsManagement.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonPaymentMethodsManagement,
    componentName: COMPONENT_NAME,
    define: defineSolvimonPaymentMethodsManagement,
} = createSolvimonElement(SolvimonPaymentMethodsManagementVue, 'payment-methods-management');
