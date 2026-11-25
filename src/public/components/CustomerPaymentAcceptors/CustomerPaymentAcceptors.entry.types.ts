import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';
import type { PaymentAcceptorsConfiguration } from '@/public/types/paymentAcceptors';

export interface SolvimonCustomerPaymentAcceptorsEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    configuration?: PaymentAcceptorsConfiguration;
}
