import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { InvoiceDetailsConfiguration } from './InvoiceDetails.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonInvoiceDetailsEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    configuration: InvoiceDetailsConfiguration;
}
