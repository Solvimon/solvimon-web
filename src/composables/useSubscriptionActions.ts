import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { useActionDispatchProvider } from '@/components/providers';
import type { SubscriptionCancellationVariant } from '@/services/subscriptions';

/**
 * Availability of the actions that can be taken on a single subscription.
 *
 * Cancelling and renewing are mutually exclusive: a subscription that is still running can be
 * cancelled, one that has been cancelled can be renewed. Both are confirmed in a modal and carried
 * out by the SDK itself, so they open that modal rather than being handed to the host; only
 * managing — which is a whole flow of the host's own — is still dispatched.
 */
export function useSubscriptionActions({
    subscription,
}: {
    subscription: Ref<PricingPlanSubscriptionExpanded | undefined>;
}): {
    isCancellable: ComputedRef<boolean>;
    isRenewable: ComputedRef<boolean>;
    pendingVariant: Ref<SubscriptionCancellationVariant | undefined>;
    cancel: () => void;
    renew: () => void;
    dismiss: () => void;
    manage: () => void;
} {
    const { dispatchAction } = useActionDispatchProvider();

    const isCancellable = computed<boolean>(() => {
        if (!subscription.value) return false;

        const inactivePeriods = subscription.value.inactive_periods;

        return !inactivePeriods || inactivePeriods.length === 0;
    });

    const isRenewable = computed<boolean>(() => {
        const inactivePeriods = subscription.value?.inactive_periods;

        return Array.isArray(inactivePeriods) && inactivePeriods.length > 0;
    });

    const pendingVariant = ref<SubscriptionCancellationVariant | undefined>();

    const cancel = () => {
        if (!subscription.value) return;

        pendingVariant.value = 'CANCEL';
    };

    const renew = () => {
        if (!subscription.value) return;

        pendingVariant.value = 'RENEW';
    };

    const dismiss = () => {
        pendingVariant.value = undefined;
    };

    const manage = () => {
        if (!subscription.value) return;

        dispatchAction({
            action: 'manage-subscription',
            data: { subscriptionId: subscription.value.id },
        });
    };

    return { isCancellable, isRenewable, pendingVariant, cancel, renew, dismiss, manage };
}
