import type { SubscriptionsListProps } from './SubscriptionsList.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonSubscriptionsListEntryProps
    extends EntryBaseProps, Pick<SubscriptionsListProps, 'configuration'> {}
