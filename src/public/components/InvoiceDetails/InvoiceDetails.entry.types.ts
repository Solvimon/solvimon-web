import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { InvoiceDetailsProps } from './InvoiceDetails.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonInvoiceDetailsEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<InvoiceDetailsProps, 'configuration'> {}
