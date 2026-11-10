import type { Invoice, Payment } from '@solvimon/solvimon-types';

export interface InvoiceConfiguration {
    invoiceId: Invoice['id'];
    /**
     * Optionally show the PDF invoice download button
     * @default true
     */
    showDownloadButton?: boolean;
    /**
     * Optionally show customer billing information
     * @default true,
     */
    showCustomerBillingInformation?: boolean;
    /**
     * Optionally show payment attempts
     * @default true
     */
    showPaymentAttempts?: boolean;
}

export interface InvoiceProps {
    invoice: Invoice;
    payments?: Payment[];
    invoiceDownloadService: (invoice: Pick<Invoice, 'id' | 'invoice_number'>) => Promise<void>;
    configuration: InvoiceConfiguration;
}
