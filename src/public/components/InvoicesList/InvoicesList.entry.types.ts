import type { InvoicesListProps } from './InvoicesList.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonInvoicesListEntryProps
    extends EntryBaseProps, Pick<InvoicesListProps, 'configuration'> {}
