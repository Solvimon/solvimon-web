import SolvimonCustomerPaymentMethodsVue from './CustomerPaymentMethods.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonCustomerPaymentMethods,
    componentName: COMPONENT_NAME,
    define: defineSolvimonCustomerPaymentMethods,
} = createSolvimonElement(SolvimonCustomerPaymentMethodsVue, 'customer-payment-methods');
