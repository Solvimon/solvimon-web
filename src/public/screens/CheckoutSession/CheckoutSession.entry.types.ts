import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';
import type { CheckoutSessionPortalUrl } from '@/types/checkoutSession';

export type SolvimonCheckoutSessionEntryProps = EntryBaseProps<CheckoutSessionPortalUrl>;

export interface SolvimonCheckoutSessionEmits extends EntryBaseEmits {
    /**
     * Emitted when the checkout is ready.
     */
    (e: 'ready'): void;
}
