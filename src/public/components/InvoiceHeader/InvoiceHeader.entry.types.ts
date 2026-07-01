import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { InvoiceHeaderProps } from './InvoiceHeader.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonInvoiceHeaderEntryProps
    extends EntryBaseProps<CustomerPortalUrl>,
        Pick<InvoiceHeaderProps, 'configuration'> {}
