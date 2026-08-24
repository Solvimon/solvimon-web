import SolvimonPayInvoiceVue from './PayInvoice.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonPayInvoice,
    componentName: COMPONENT_NAME,
    define: defineSolvimonPayInvoice,
} = createSolvimonElement(SolvimonPayInvoiceVue, 'pay-invoice');
