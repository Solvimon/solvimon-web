import InvoiceVue from './Invoice.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonInvoice } = createSolvimonElement(InvoiceVue, 'invoice');
