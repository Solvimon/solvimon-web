import type { CustomerPortalUrl } from '@solvimon/types';
import type { InvoiceProps } from './Invoice.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonInvoiceEntryProps
    extends EntryBaseProps<CustomerPortalUrl>, Pick<InvoiceProps, 'configuration'> {}
