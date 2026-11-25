import SubscriptionPaymentAcceptorsVue from './SubscriptionPaymentAcceptors.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export type { SolvimonSubscriptionPaymentAcceptorsEntryProps } from './SubscriptionPaymentAcceptors.entry.types';
export type {
    PaymentAcceptorAssignment,
    SubscriptionPaymentAcceptorsConfiguration,
} from '@/public/types/paymentAcceptors';

export const { define: defineSolvimonSubscriptionPaymentAcceptors } = createSolvimonElement(
    SubscriptionPaymentAcceptorsVue,
    'subscription-payment-acceptors',
);
