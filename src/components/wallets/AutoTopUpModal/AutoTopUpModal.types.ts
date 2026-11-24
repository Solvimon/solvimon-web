import type {
    ChargeOnDemandPricingItem,
    Customer,
    CustomerWalletBalanceItem,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export type AutoTopUpModalStep = 'AUTO_TOP_UP' | 'ADD_PAYMENT_METHOD';

export const AUTO_TOP_UP_MODAL_STEPS: AutoTopUpModalStep[] = ['AUTO_TOP_UP', 'ADD_PAYMENT_METHOD'];

export interface AutoTopUpModalProps {
    showModal: boolean;
    walletBalanceItem?: CustomerWalletBalanceItem;
    topUpItem?: ChargeOnDemandPricingItem;
    paymentMethods?: PaymentMethod[];
    customer?: Customer;
    /** Where a credits wallet's top-up takes its currency from: the subscription it is charged on. */
    subscriptions?: PricingPlanSubscriptionExpanded[];
}

export interface AutoTopUpModalEmits {
    (e: 'saved'): void;
    (e: 'close'): void;
    (e: 'payment-success'): void;
    (e: 'payment-failed', error: unknown): void;
}
