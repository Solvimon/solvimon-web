import SolvimonSubscriptionManagementVue from './SubscriptionManagement.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonSubscriptionManagement,
    componentName: COMPONENT_NAME,
    define: defineSolvimonSubscriptionManagement,
} = createSolvimonElement(SolvimonSubscriptionManagementVue, 'subscription-management');
