import type {
    ChargeOnDemandPricingItemsPayload,
    Invoice,
    PaymentMethod,
    PaymentMethodOptionsResponse,
    PricingPlanSchedule,
} from '@solvimon/solvimon-types';
import type { TopUpPricingItem } from './TopUpModal.lib';
import type { AutoTopUpRule } from '@/components/wallets/AutoTopUpConfig/AutoTopUpConfig.types';

export interface TopUpModalFormProps {
    /**
     * The ways this wallet can be topped up. Already flattened to on-demand pricing configs by
     * `getTopUpPricingItems`, since the raw balances field cannot be walked directly.
     */
    topUpPricingItems: TopUpPricingItem[] | undefined;
    paymentMethods?: PaymentMethod[];
    paymentMethodOptions?: PaymentMethodOptionsResponse;
    autoTopUpConfig?: AutoTopUpRule;
    /** A wallet not bought yet has nothing to save an auto top-up rule against. */
    isNewWallet?: boolean;
}

export interface TopUpModalFormEmits {
    (e: 'add-payment-method'): void;
    (e: 'success', invoice: Invoice): void;
    (
        e: 'save-auto-top-up',
        request: {
            rule: AutoTopUpRule;
            paymentMethodId: PaymentMethod['id'];
            /** The schedule the top-up was charged on, which the rule is billed on too. */
            pricingPlanScheduleId: PricingPlanSchedule['id'];
        },
    ): void;
    (e: 'failure', error: unknown): void;
}

export type TopUpModalFormState = ChargeOnDemandPricingItemsPayload;
