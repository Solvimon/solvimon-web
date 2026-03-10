import type { CustomerOverviewProps } from './CustomerOverview.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface CustomerOverviewEntryProps
    extends EntryBaseProps, Pick<CustomerOverviewProps, 'configuration'> {}
