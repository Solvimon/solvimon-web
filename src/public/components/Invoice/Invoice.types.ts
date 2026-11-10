import type { Invoice, Payment } from '@solvimon/solvimon-types';

export interface InvoiceConfiguration {
    invoiceId: Invoice['id'];
    /**
     * Whether to show the button that downloads the invoice as a PDF.
     * @default true
     */
    showDownloadButton?: boolean;
    /**
     * Whether to show the customer's billing information.
     * @default true
     */
    showCustomerBillingInformation?: boolean;
    /**
     * Whether to show the invoice's payment attempts, when it has any.
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
