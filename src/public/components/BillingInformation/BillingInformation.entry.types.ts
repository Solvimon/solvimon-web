import type { CustomerPortalUrl } from '@solvimon/types';
import type { BillingInformationProps } from './BillingInformation.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export type SolvimonBillingInformationEntryProps = EntryBaseProps<CustomerPortalUrl> &
    Pick<BillingInformationProps, 'configuration'>;
