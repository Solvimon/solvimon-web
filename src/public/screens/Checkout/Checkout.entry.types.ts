import type { CheckoutPagePortalUrl } from '@solvimon/solvimon-types';
import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';
import type { CheckoutProps } from '@/public/screens/Checkout/Checkout.types';

export interface SolvimonCheckoutEntryProps
    extends EntryBaseProps<CheckoutPagePortalUrl>, CheckoutProps {}

export interface SolvimonCheckoutEmits extends EntryBaseEmits {
    /**
     * Emitted when the checkout is ready.
     */
    (e: 'ready'): void;
}
