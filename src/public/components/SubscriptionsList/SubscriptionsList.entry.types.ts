import type { CustomerPortalUrl } from '@solvimon/types';
import type { SubscriptionsListProps } from './SubscriptionsList.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonSubscriptionsListEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<SubscriptionsListProps, 'configuration'> {}
