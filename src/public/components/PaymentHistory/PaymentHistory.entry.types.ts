import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { PaymentHistoryProps } from './PaymentHistory.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonPaymentHistoryEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<PaymentHistoryProps, 'configuration'> {}
