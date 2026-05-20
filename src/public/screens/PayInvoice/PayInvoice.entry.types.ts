import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { PayInvoiceProps } from './PayInvoice.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export type SolvimonPayInvoiceEntryProps = EntryBaseProps<CustomerPortalUrl> &
    Pick<PayInvoiceProps, 'configuration'>;
