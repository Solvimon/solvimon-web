import SolvimonCustomerOverviewVue from './CustomerOverview.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonCustomerOverview } = createSolvimonElement(
    SolvimonCustomerOverviewVue,
    'customer-overview',
);
