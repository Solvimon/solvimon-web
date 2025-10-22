import type { PortalUrl } from '@solvimon/types';

export interface CustomerPaymentMethodsBlockProps {
    portalUrl: PortalUrl;
}

export interface CustomerPaymentMethodsBlockEmits {
    (e: 'payment-method-updated'): void;
    (e: 'view-all', routeName: string): void;
    (e: 'add-payment-method', routeName: string): void;
}
