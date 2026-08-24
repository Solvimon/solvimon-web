import SolvimonInvoicesListVue from './InvoicesList.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonInvoicesList,
    componentName: COMPONENT_NAME,
    define: defineSolvimonInvoicesList,
} = createSolvimonElement(SolvimonInvoicesListVue, 'invoices-list');
