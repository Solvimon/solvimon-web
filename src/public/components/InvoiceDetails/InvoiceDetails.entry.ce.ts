import InvoiceDetailsVue from './InvoiceDetails.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonInvoiceDetails } = createSolvimonElement(
    InvoiceDetailsVue,
    'invoice-details',
);
