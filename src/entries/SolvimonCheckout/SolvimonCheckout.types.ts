import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';
import type { CheckoutProps } from '@/views/Checkout/Checkout.types';

export interface SolvimonCheckoutProps extends EntryBaseProps, CheckoutProps {}
export interface SolvimonCheckoutEmits extends EntryBaseEmits {}
