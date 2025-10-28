import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonInvoiceDetailsBlockProps extends EntryBaseProps {
    /**
     * The ID of the invoice whose details should be displayed.
     */
    invoiceId: string;
}

export interface SolvimonInvoiceDetailsBlockEmits extends EntryBaseEmits {
    (e: 'error', payload: { title: string; message: string }): void;
}
