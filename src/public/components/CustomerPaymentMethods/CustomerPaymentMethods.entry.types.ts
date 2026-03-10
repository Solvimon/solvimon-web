import type { CustomerPaymentMethodsProps } from './CustomerPaymentMethods.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonCustomerPaymentMethodsEntryProps
    extends EntryBaseProps, Pick<CustomerPaymentMethodsProps, 'configuration'> {}
