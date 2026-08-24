import InvoiceHeaderVue from './InvoiceHeader.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonInvoiceHeader,
    componentName: COMPONENT_NAME,
    define: defineSolvimonInvoiceHeader,
} = createSolvimonElement(InvoiceHeaderVue, 'invoice-header');
