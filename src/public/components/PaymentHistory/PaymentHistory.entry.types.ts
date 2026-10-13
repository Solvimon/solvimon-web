import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { PaymentHistoryConfiguration } from './PaymentHistory.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonPaymentHistoryEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    configuration: PaymentHistoryConfiguration;
}
