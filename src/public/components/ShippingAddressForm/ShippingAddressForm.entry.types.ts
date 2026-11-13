import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { ShippingAddressFormConfiguration } from './ShippingAddressForm.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonShippingAddressFormEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    configuration?: ShippingAddressFormConfiguration;
}
