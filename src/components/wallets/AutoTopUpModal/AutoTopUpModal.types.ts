import type {
    ChargeOnDemandPricingItem,
    Customer,
    CustomerWalletBalanceItem,
    PaymentMethod,
} from '@solvimon/solvimon-types';

export type AutoTopUpModalStep = 'AUTO_TOP_UP' | 'ADD_PAYMENT_METHOD';

export const AUTO_TOP_UP_MODAL_STEPS: AutoTopUpModalStep[] = ['AUTO_TOP_UP', 'ADD_PAYMENT_METHOD'];

export interface AutoTopUpModalProps {
    showModal: boolean;
    walletBalanceItem?: CustomerWalletBalanceItem;
    topUpItem?: ChargeOnDemandPricingItem;
    paymentMethods?: PaymentMethod[];
    customer?: Customer;
}

export interface AutoTopUpModalEmits {
    (e: 'saved'): void;
    (e: 'close'): void;
    (e: 'payment-success'): void;
    (e: 'payment-failed', error: unknown): void;
}
