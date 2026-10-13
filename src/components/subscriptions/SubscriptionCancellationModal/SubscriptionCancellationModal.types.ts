import type {
    Customer,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import type { SubscriptionCancellationVariant } from '@/services/subscriptions';

export interface SubscriptionCancellationModalProps {
    showModal: boolean;
    variant?: SubscriptionCancellationVariant;
    subscription?: PricingPlanSubscriptionExpanded;
    /** Whose timezone the dates are shown in. */
    customer?: Customer;
    /** The subscription's own payment method, shown in the summary. */
    paymentMethod?: PaymentMethod;
    avatar?: string;
}

export interface SubscriptionCancellationModalEmits {
    (e: 'confirmed'): void;
    (e: 'close'): void;
}
