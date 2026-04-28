import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { PaymentMethodFormProps } from './PaymentMethodForm.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonPaymentMethodFormEntryProps
    extends
        EntryBaseProps<CustomerPortalUrl>,
        Pick<PaymentMethodFormProps, 'configuration' | 'countryCode'> {}
