import SubscriptionSchedulesVue from './SubscriptionSchedules.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonSubscriptionSchedules } = createSolvimonElement(
    SubscriptionSchedulesVue,
    'subscription-schedules',
);
