import type { Invoice, Payment } from '@solvimon/types';

export interface InvoiceConfiguration {
    invoiceId: Invoice['id'];
    /**
     * Optionally show the PDF invoice download button
     * @default true
     */
    enableDownloadButton?: boolean;
    /**
     * Optionally show customer billing information
     * @default true,
     */
    enableCustomerBillingInformation?: boolean;
    /**
     * Optionally show payment attempts
     * @default true
     */
    enablePaymentAttempts?: boolean;
}

export interface InvoiceProps {
    isLoading: boolean;
    invoice: Invoice;
    payments?: Payment[];
    invoiceDownloadService: (id: Invoice['id']) => Promise<void>;
    configuration: InvoiceConfiguration;
}
