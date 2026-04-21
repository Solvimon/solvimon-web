import type { CustomerPortalUrl } from '@solvimon/types';
import type { CustomerPaymentMethodsProps } from './CustomerPaymentMethods.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonCustomerPaymentMethodsEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<CustomerPaymentMethodsProps, 'configuration'> {
    portalObject: CustomerPortalUrl;
}
