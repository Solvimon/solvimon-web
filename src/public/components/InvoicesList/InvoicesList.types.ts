import type { Invoice } from '@solvimon/types';

export interface InvoicesListConfiguration {
    showPayButton?: boolean;
    showViewButton?: boolean;
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
