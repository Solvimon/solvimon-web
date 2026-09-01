import SubscriptionsListVue from './SubscriptionsList.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonSubscriptionsList } = createSolvimonElement(
    SubscriptionsListVue,
    'subscriptions-list',
);
