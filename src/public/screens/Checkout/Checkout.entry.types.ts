import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';
import type { CheckoutProps } from '@/public/screens/Checkout/Checkout.types';

export interface SolvimonCheckoutProps extends EntryBaseProps, CheckoutProps {}

export interface SolvimonCheckoutEmits extends EntryBaseEmits {
    /**
     * Emitted when an error occurs.
     */
    (e: 'error', payload: { title: string; message: string }): void;
    /**
     * Emitted when the checkout is ready.
     */
    (e: 'ready'): void;
}
