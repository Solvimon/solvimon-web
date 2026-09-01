import SolvimonSubscriptionDetailsVue from './SubscriptionDetails.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonSubscriptionDetails } = createSolvimonElement(
    SolvimonSubscriptionDetailsVue,
    'subscription-details',
);
