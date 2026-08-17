import type {
    Customer,
    CustomerWalletBalanceItem,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export interface CustomerWalletBalancesProps {
    hasError: boolean;
    isLoading: boolean;
    walletBalances: CustomerWalletBalanceItem[];
    /**
     * Whether topping up is offered at all. Per wallet the button only shows when that wallet has
     * on-demand pricing items to charge.
     */
    showTopUpButton?: boolean;
    /** The customer being charged; the top-up's payment form needs their country, name and email. */
    customer?: Customer;
    /** The customer's stored payment methods, to pay a top-up with. */
    paymentMethods?: PaymentMethod[];
    /**
     * The subscriptions a wallet may be topped up through. Passing them scopes the top-up: only the
     * items billed on their schedules are offered, and the customer is asked which one when a wallet
     * is granted by more than one. Leave out where there is no subscription context.
     */
    subscriptions?: PricingPlanSubscriptionExpanded[];
}

export interface CustomerWalletBalancesEmits {
    /** A top-up was charged, so the balance it credited is out of date. */
    (e: 'top-up-charged'): void;
    /** A new payment method was tokenized and stored while topping up. */
    (e: 'payment-method-stored'): void;
    /** Storing a payment method failed. */
    (e: 'payment-failed', error: unknown): void;
}
