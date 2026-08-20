import type {
    ChargeOnDemandPricingItemsPayload,
    Invoice,
    PaymentMethod,
    PaymentMethodOptionsResponse,
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
}

export interface TopUpModalFormEmits {
    (e: 'add-payment-method'): void;
    (e: 'success', invoice: Invoice): void;
    (
        e: 'save-auto-top-up',
        request: { rule: AutoTopUpRule; paymentMethodId: PaymentMethod['id'] },
    ): void;
    (e: 'failure', error: unknown): void;
}

export type TopUpModalFormState = ChargeOnDemandPricingItemsPayload;
