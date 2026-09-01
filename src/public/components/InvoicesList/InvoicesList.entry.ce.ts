import SolvimonInvoicesListVue from './InvoicesList.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonInvoicesList } = createSolvimonElement(
    SolvimonInvoicesListVue,
    'invoices-list',
);
