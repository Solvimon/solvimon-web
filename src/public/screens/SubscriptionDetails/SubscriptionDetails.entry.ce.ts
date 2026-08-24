import SolvimonSubscriptionDetailsVue from './SubscriptionDetails.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonSubscriptionDetails,
    componentName: COMPONENT_NAME,
    define: defineSolvimonSubscriptionDetails,
} = createSolvimonElement(SolvimonSubscriptionDetailsVue, 'subscription-details');
