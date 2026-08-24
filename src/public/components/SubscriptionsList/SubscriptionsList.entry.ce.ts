import SubscriptionsListVue from './SubscriptionsList.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonSubscriptionsList,
    componentName: COMPONENT_NAME,
    define: defineSolvimonSubscriptionsList,
} = createSolvimonElement(SubscriptionsListVue, 'subscriptions-list');
