import SubscriptionSchedulesVue from './SubscriptionSchedules.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonSubscriptionSchedules,
    componentName: COMPONENT_NAME,
    define: defineSolvimonSubscriptionSchedules,
} = createSolvimonElement(SubscriptionSchedulesVue, 'subscription-schedules');
