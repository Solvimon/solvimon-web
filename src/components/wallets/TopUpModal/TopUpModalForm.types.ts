import type {
    ChargeOnDemandPricingItemsPayload,
    Invoice,
    PaymentMethod,
} from '@solvimon/solvimon-types';
import type { TopUpPricingItem } from './TopUpModal.lib';

export interface TopUpModalFormProps {
    /**
     * The ways this wallet can be topped up. Already flattened to on-demand pricing configs by
     * `getTopUpPricingItems`, since the raw balances field cannot be walked directly.
     */
    topUpPricingItems: TopUpPricingItem[] | undefined;
    /** The customer's stored payment methods, to pay the top-up with. */
    paymentMethods?: PaymentMethod[];
}

export interface TopUpModalFormEmits {
    /**
     * The customer wants to pay with a method they have not saved yet. Handled by the modal, which
     * swaps its whole body over to the form for adding one.
     */
    (e: 'add-payment-method'): void;
    /** The top-up was charged, and this is the invoice it produced. */
    (e: 'success', invoice: Invoice): void;
    (e: 'failure', error: unknown): void;
}

export type TopUpModalFormState = ChargeOnDemandPricingItemsPayload;
