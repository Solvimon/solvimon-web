import type { Invoice, Payment } from '@solvimon/solvimon-types';

export interface InvoiceHeaderConfiguration {
    invoiceId: Invoice['id'];
    /**
     * Whether to show the button that downloads the invoice as a PDF.
     * @default true
     */
    showDownloadButton?: boolean;
}

export interface InvoiceHeaderProps {
    invoice: Invoice;
    payments?: Payment[];
    invoiceDownloadService: (invoice: Pick<Invoice, 'id' | 'invoice_number'>) => Promise<void>;
    configuration: InvoiceHeaderConfiguration;
}
