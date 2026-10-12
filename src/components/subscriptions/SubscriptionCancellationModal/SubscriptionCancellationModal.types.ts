import type { Customer } from '@solvimon/solvimon-types';
import type { SubscriptionCancellationVariant } from '@/services/subscriptions';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface SubscriptionCancellationModalProps {
    showModal: boolean;
    variant?: SubscriptionCancellationVariant;
    subscription?: PricingPlanSubscriptionExpanded;
    /** Whose timezone the dates are shown in. */
    customer?: Customer;
    avatar?: string;
}

export interface SubscriptionCancellationModalEmits {
    (e: 'confirmed'): void;
    (e: 'close'): void;
}
