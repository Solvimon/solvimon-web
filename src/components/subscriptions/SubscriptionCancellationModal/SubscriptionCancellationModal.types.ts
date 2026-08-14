import type { SubscriptionCancellationVariant } from '@/services/subscriptions';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface SubscriptionCancellationModalProps {
    showModal: boolean;
    variant?: SubscriptionCancellationVariant;
    subscription?: PricingPlanSubscriptionExpanded;
    avatar?: string;
}

export interface SubscriptionCancellationModalEmits {
    (e: 'confirmed'): void;
    (e: 'close'): void;
}
