import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { CustomerOverviewProps } from './CustomerOverview.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonCustomerOverviewEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<CustomerOverviewProps, 'configuration'> {}
