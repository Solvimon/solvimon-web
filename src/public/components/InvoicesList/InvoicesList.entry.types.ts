import type { CustomerPortalUrl } from '@solvimon/types';
import type { InvoicesListProps } from './InvoicesList.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonInvoicesListEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<InvoicesListProps, 'configuration'> {}
