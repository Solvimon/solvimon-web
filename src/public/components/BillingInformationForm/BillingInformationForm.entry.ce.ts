import BillingInformationFormVue from './BillingInformationForm.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonBillingInformationForm } = createSolvimonElement(
    BillingInformationFormVue,
    'billing-information-form',
);
