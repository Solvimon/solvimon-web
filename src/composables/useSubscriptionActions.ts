import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { Pricing, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { useActionDispatchProvider } from '@/components/providers';
import type { SubscriptionCancellationVariant } from '@/services/subscriptions';
import {
    getOpenInactivePeriod,
    getUndoableCancellation,
    isCancellationManageable,
} from '@/utils/subscription';

/**
 * Availability of the actions that can be taken on a single subscription.
 *
 * Cancelling and renewing are mutually exclusive: a subscription that is still running can be
 * cancelled, one whose cancellation has yet to take effect can be renewed. Both are confirmed in a modal and carried
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
    /** What the customer last confirmed, kept after the modal closes so the screen can say so. */
    confirmedVariant: Ref<SubscriptionCancellationVariant | undefined>;
    confirm: () => void;
    cancel: () => void;
    renew: () => void;
    dismiss: () => void;
    manage: (enabledPricingId?: Pricing['id']) => void;
} {
    const { dispatchAction } = useActionDispatchProvider();

    /** The API cancels only an active billing subscription, and only once until that is undone. */
    const isCancellable = computed<boolean>(
        () =>
            isCancellationManageable(subscription.value) &&
            !getOpenInactivePeriod(subscription.value, 'CANCEL'),
    );

    const isRenewable = computed<boolean>(() =>
        Boolean(getUndoableCancellation(subscription.value)),
    );

    const pendingVariant = ref<SubscriptionCancellationVariant | undefined>();
    const confirmedVariant = ref<SubscriptionCancellationVariant | undefined>();

    // A second confirmation replaces the first rather than stacking.
    watch(pendingVariant, (variant) => {
        if (variant) confirmedVariant.value = undefined;
    });

    const confirm = () => {
        confirmedVariant.value = pendingVariant.value;
    };

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

    /** Names the pricing the customer came from, so the host opens the group it belongs to. */
    const manage = (enabledPricingId?: Pricing['id']) => {
        if (!subscription.value) return;

        dispatchAction({
            action: 'manage-subscription',
            data: {
                subscriptionId: subscription.value.id,
                ...(enabledPricingId && { enabledPricingId }),
            },
        });
    };

    return {
        isCancellable,
        isRenewable,
        pendingVariant,
        confirmedVariant,
        confirm,
        cancel,
        renew,
        dismiss,
        manage,
    };
}
