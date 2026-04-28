import type { Invoice } from '@solvimon/solvimon-types';

export interface InvoiceDetailsConfiguration {
    invoiceId: Invoice['id'];
}

export interface InvoiceDetailsProps {
    invoice: Invoice;
    isLoading: boolean;
    configuration: InvoiceDetailsConfiguration;
}
