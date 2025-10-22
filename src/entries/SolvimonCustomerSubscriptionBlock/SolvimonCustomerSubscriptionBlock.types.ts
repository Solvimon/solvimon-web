import type { PortalUrl } from '@solvimon/types';
import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';
export interface SolvimonCustomerSubscriptionBlockProps extends EntryBaseProps {
    hideCtaButtons?: boolean;
    portalUrl: PortalUrl;
}

export interface SolvimonCustomerSubscriptionBlockEmits extends EntryBaseEmits {
    (e: 'view-details', payload: { subscriptionId: string; routeName: string }): void;
    (e: 'cancel-subscription', payload: { subscriptionId: string; routeName: string }): void;
    (e: 'renew-subscription', payload: { subscriptionId: string; routeName: string }): void;
    (e: 'view-all', routeName: string): void;
}
