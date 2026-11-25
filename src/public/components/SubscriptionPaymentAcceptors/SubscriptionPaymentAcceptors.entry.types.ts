import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';
import type { SubscriptionPaymentAcceptorsConfiguration } from '@/public/types/paymentAcceptors';

export interface SolvimonSubscriptionPaymentAcceptorsEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    configuration: SubscriptionPaymentAcceptorsConfiguration;
}
