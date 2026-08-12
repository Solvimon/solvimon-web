import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { SubscriptionManagementProps } from './SubscriptionManagement.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonSubscriptionManagementEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<SubscriptionManagementProps, 'configuration'> {}
