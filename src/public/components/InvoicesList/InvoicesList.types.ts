import type { Invoice } from '@solvimon/solvimon-types';

export interface InvoicesListConfiguration {
    /**
     * Whether to show the pay button when an invoice is not paid.
     * @default true
     */
    showPayButton?: boolean;
    /**
     * Whether to show the view button when an invoice is not paid.
     * @default true
     */
    showViewButton?: boolean;
    /**
     * Optionally configure pagination.
     */
    pagination?: {
        /**
         * Wether or not pagination should be enabled
         * @default true
         */
        enabled?: boolean;
        /**
         * Optionally set a custom batch size. Maximum is 50.
         * @default 15
         */
        batchSize?: number;
    };
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
