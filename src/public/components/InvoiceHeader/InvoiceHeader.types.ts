import type { Invoice, Payment } from '@solvimon/solvimon-types';

export interface InvoiceHeaderConfiguration {
    invoiceId: Invoice['id'];
    /**
     * Optionally show the PDF invoice download button
     * @default true
     */
    enableDownloadButton?: boolean;
}

export interface InvoiceHeaderProps {
    isLoading: boolean;
    invoice: Invoice;
    payments?: Payment[];
    invoiceDownloadService: (invoice: Pick<Invoice, 'id' | 'invoice_number'>) => Promise<void>;
    configuration: InvoiceHeaderConfiguration;
}
