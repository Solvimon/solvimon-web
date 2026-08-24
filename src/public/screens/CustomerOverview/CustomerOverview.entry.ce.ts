import SolvimonCustomerOverviewVue from './CustomerOverview.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonCustomerOverview,
    componentName: COMPONENT_NAME,
    define: defineSolvimonCustomerOverview,
} = createSolvimonElement(SolvimonCustomerOverviewVue, 'customer-overview');
