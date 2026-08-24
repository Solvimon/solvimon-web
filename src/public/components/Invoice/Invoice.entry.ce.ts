import InvoiceVue from './Invoice.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonInvoice,
    componentName: COMPONENT_NAME,
    define: defineSolvimonInvoice,
} = createSolvimonElement(InvoiceVue, 'invoice');
