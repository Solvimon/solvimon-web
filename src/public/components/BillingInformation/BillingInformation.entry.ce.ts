import BillingInformationVue from './BillingInformation.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonBillingInformation,
    componentName: COMPONENT_NAME,
    define: defineSolvimonBillingInformation,
} = createSolvimonElement(BillingInformationVue, 'billing-information');
