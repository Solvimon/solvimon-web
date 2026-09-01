import PaymentMethodFormVue from './PaymentMethodForm.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonPaymentMethodForm } = createSolvimonElement(
    PaymentMethodFormVue,
    'payment-method-form',
);
