import type { PortalUrl } from '@solvimon/types';
import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonCustomerPaymentMethodsBlockProps extends EntryBaseProps {
    portalUrl: PortalUrl;
}

export interface SolvimonCustomerPaymentMethodsBlockEmits extends EntryBaseEmits {
    (e: 'payment-method-updated'): void;
    (e: 'view-all', routeName: string): void;
    (e: 'add-payment-method', routeName: string): void;
}
