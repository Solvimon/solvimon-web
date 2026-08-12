import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { SubscriptionDetailsConfiguration } from './SubscriptionDetails.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonSubscriptionDetailsEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    configuration: SubscriptionDetailsConfiguration;
}
