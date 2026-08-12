import { computed, type ComputedRef, type Ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { useActionDispatchProvider } from '@/components/providers';

/**
 * Availability of — and dispatching for — the actions a host can take on a single subscription.
 *
 * Cancelling and renewing are mutually exclusive: a subscription that is still running can be
 * cancelled, one that has been cancelled can be renewed.
 */
export function useSubscriptionActions({
    subscription,
}: {
    subscription: Ref<PricingPlanSubscriptionExpanded | undefined>;
}): {
    isCancellable: ComputedRef<boolean>;
    isRenewable: ComputedRef<boolean>;
    cancel: () => void;
    renew: () => void;
    manage: () => void;
} {
    const { dispatchAction } = useActionDispatchProvider();

    /** A subscription that has never been cancelled has no inactive periods. */
    const isCancellable = computed<boolean>(() => {
        if (!subscription.value) return false;

        const inactivePeriods = subscription.value.inactive_periods;

        return !inactivePeriods || inactivePeriods.length === 0;
    });

    const isRenewable = computed<boolean>(() => {
        const inactivePeriods = subscription.value?.inactive_periods;

        return Array.isArray(inactivePeriods) && inactivePeriods.length > 0;
    });

    const cancel = () => {
        if (!subscription.value) return;

        dispatchAction({
            action: 'cancel-subscription',
            data: { subscriptionId: subscription.value.id },
        });
    };

    const renew = () => {
        if (!subscription.value) return;

        dispatchAction({
            action: 'renew-subscription',
            data: { subscriptionId: subscription.value.id },
        });
    };

    /** Hands off to the host's upgrade flow, where the plan and its pricings can be changed. */
    const manage = () => {
        if (!subscription.value) return;

        dispatchAction({
            action: 'manage-subscription',
            data: { subscriptionId: subscription.value.id },
        });
    };

    return { isCancellable, isRenewable, cancel, renew, manage };
}
