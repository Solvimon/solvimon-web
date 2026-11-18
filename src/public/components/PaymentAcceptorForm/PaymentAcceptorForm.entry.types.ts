import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { PaymentAcceptorFormConfiguration } from './PaymentAcceptorForm.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonPaymentAcceptorFormEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    configuration?: PaymentAcceptorFormConfiguration;
}
