import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonInvoiceBlockProps extends EntryBaseProps {
    /**
     * The ID of the invoice to be displayed
     */
    invoiceId: string;
    /**
     * Whether to show the customer billing information.
     * @default: true
     */
    showCustomerBillingInformation?: boolean;
}
export interface SolvimonInvoiceBlockEmits extends EntryBaseEmits {
    (e: 'error', payload: { title: string; message: string }): void;
}
