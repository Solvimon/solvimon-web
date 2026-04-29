import type { CustomerPortalUrl } from '@solvimon/solvimon-types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonWalletBalancesEntryProps extends EntryBaseProps<CustomerPortalUrl> {
    portalObject: CustomerPortalUrl;
}
