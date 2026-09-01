import InvoiceHeaderVue from './InvoiceHeader.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonInvoiceHeader } = createSolvimonElement(
    InvoiceHeaderVue,
    'invoice-header',
);
