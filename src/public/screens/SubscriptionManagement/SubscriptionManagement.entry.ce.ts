import SolvimonSubscriptionManagementVue from './SubscriptionManagement.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonSubscriptionManagement } = createSolvimonElement(
    SolvimonSubscriptionManagementVue,
    'subscription-management',
);
