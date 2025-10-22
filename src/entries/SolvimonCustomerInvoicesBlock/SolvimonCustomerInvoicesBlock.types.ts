import type { Invoice, PortalUrl } from '@solvimon/types';
import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';
export interface SolvimonCustomerInvoicesBlockProps extends EntryBaseProps {
    portalUrl: PortalUrl;
}

export interface SolvimonCustomerInvoicesBlockEmits extends EntryBaseEmits {
    (e: 'view-all', routeName: string): void;
    (e: 'view-invoice', payload: { invoiceId: Invoice['id']; routeName: string }): void;
    (e: 'pay-invoice', payload: { invoiceId: Invoice['id']; routeName: string }): void;
}
