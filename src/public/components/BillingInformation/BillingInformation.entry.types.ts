import type { BillingInformationProps } from './BillingInformation.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export type SolvimonBillingInformationEntryProps = EntryBaseProps &
    Pick<BillingInformationProps, 'configuration'>;
