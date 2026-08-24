import PaymentMethodFormVue from './PaymentMethodForm.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonPaymentMethodForm,
    componentName: COMPONENT_NAME,
    define: defineSolvimonPaymentMethodForm,
} = createSolvimonElement(PaymentMethodFormVue, 'payment-method-form');
