import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { UpgradeSubscriptionProps } from './UpgradeSubscription.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonUpgradeSubscriptionEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<UpgradeSubscriptionProps, 'configuration'> {}
