import type { Invoice, Payment } from '@solvimon/solvimon-types';

export interface InvoiceDetailProps {
    invoice: Invoice;
    paymentAttempts?: Payment[];
    downloadService: (id: Invoice['id']) => Promise<void>;
    /**
     * Optionally show download button
     * @default true
     */
    showDownloadButton?: boolean;
    /**
     * Whether to show the customer billing information.
     * @default true
     */
    showCustomerBillingInformation?: boolean;
    /**
     * Optionally show payment attempts
     * @default true
     */
    showPaymentAttempts?: boolean;
}
