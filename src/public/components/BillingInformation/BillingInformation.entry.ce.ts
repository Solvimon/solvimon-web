import BillingInformationVue from './BillingInformation.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonBillingInformation } = createSolvimonElement(
    BillingInformationVue,
    'billing-information',
);
