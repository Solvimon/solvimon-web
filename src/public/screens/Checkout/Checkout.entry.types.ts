import type { CheckoutPagePortalUrl } from '@solvimon/solvimon-types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';
import type { CheckoutProps } from '@/public/screens/Checkout/Checkout.types';

export interface SolvimonCheckoutEntryProps
    extends EntryBaseProps<CheckoutPagePortalUrl>, CheckoutProps {}
