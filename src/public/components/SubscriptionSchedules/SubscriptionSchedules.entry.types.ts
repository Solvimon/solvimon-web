import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { SubscriptionSchedulesConfiguration } from './SubscriptionSchedules.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonSubscriptionSchedulesEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    configuration: SubscriptionSchedulesConfiguration;
}
