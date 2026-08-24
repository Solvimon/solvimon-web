import BillingInformationFormVue from './BillingInformationForm.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonBillingInformationForm,
    componentName: COMPONENT_NAME,
    define: defineSolvimonBillingInformationForm,
} = createSolvimonElement(BillingInformationFormVue, 'billing-information-form');
