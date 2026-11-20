import PaymentAcceptorFormVue from './PaymentAcceptorForm.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonPaymentAcceptorForm } = createSolvimonElement(
    PaymentAcceptorFormVue,
    'payment-acceptor-form',
);
