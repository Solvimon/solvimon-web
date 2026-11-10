import type { Invoice } from '@solvimon/solvimon-types';

export interface InvoicesListConfiguration {
    /**
     * Whether to show the pay button on an invoice that can be paid, which sends a `pay-invoice`
     * action request.
     * @default true
     */
    showPayButton?: boolean;
    /**
     * Whether to link each invoice to its page, which sends a `view-invoice` action request.
     * @default true
     */
    showViewButton?: boolean;
    /** How the list loads more invoices. */
    pagination?: {
        /**
         * Whether the list offers to load more invoices than the first batch.
         * @default true
         */
        enabled?: boolean;
        /**
         * How many invoices the list loads at a time, at most 50.
         * @default 15
         */
        batchSize?: number;
    };
}

export interface InvoicesListProps {
    invoices: Invoice[];
    isLoading: boolean;
    /** Set when the invoices, or the next batch of them, failed to load. */
    error?: Error | null;
    hasMoreItems: boolean;
    configuration?: InvoicesListConfiguration;
}

export interface InvoicesListEmits {
    (e: 'load-more'): void;
}
