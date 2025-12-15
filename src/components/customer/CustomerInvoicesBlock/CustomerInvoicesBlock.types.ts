import type { Invoice } from '@solvimon/types';

export interface CustomerInvoicesBlockProps {
    showOverviewLink?: boolean;
}

export interface CustomerInvoicesBlockEmits {
    (e: 'view-all', routeName: string): void;
    (e: 'view-invoice', payload: { invoiceId: Invoice['id']; routeName: string }): void;
    (e: 'pay-invoice', payload: { invoiceId: Invoice['id']; routeName: string }): void;
}
