import type { Invoice } from '@solvimon/types';

export interface InvoicesListConfiguration {
    /**
     * Whether to show the pay button when an invoice is not paid.
     */
    showPayButton?: boolean;
    /**
     * Whether to show the view button when an invoice is not paid.
     */
    showViewButton?: boolean;
    /**
     * The number of invoices to load per page.
     * @default 15
     */
    batchSize?: number;
}

export interface InvoicesListProps {
    invoices: Invoice[];
    isLoading: boolean;
    hasMoreItems: boolean;
    configuration?: InvoicesListConfiguration;
}

export interface InvoicesListEmits {
    (e: 'load-more'): void;
}
