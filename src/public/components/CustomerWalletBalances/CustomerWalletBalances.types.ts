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
    showTopUpButton?: boolean;
    customer?: Customer;
    paymentMethods?: PaymentMethod[];
    /**
     * The subscriptions a wallet may be topped up through. Passing them scopes the top-up: only the
     * items billed on their schedules are offered, and the customer is asked which one when a wallet
     * is granted by more than one. Leave out where there is no subscription context.
     */
    subscriptions?: PricingPlanSubscriptionExpanded[];
}

export interface CustomerWalletBalancesEmits {
    (e: 'top-up-charged'): void;
    (e: 'auto-top-up-saved'): void;
    (e: 'auto-top-up-cancelled'): void;
    (e: 'payment-method-stored'): void;
    (e: 'payment-failed', error: unknown): void;
}
