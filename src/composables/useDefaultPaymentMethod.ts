import type { PaymentMethod } from '@solvimon/solvimon-types';
import { computed, watch, type Ref } from 'vue';

const toTime = (createdAt?: string) => {
    const parsed = Date.parse(createdAt ?? '');

    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Keeps a payment method chosen, so paying for something is one press in the common case.
 *
 * Which one, in order: the method the customer has just added, since adding it was a deliberate act;
 * whatever they have already chosen, so a list arriving late cannot overrule them; a method the thing
 * being paid for already charges; their default; and failing all that the newest they have.
 */
export function useDefaultPaymentMethod({
    paymentMethods,
    selectedPaymentMethodId,
    preferredPaymentMethodId,
}: {
    paymentMethods: Ref<PaymentMethod[] | undefined>;
    /** The caller's own selection, which this drives — a payload field, a ref of its own, either. */
    selectedPaymentMethodId: Ref<PaymentMethod['id'] | undefined>;
    /**
     * A method the thing being paid for is already set up to charge, such as the one an existing rule
     * runs on. Wins while the customer has chosen nothing themselves, and is ignored once the method
     * is gone.
     */
    preferredPaymentMethodId?: Ref<PaymentMethod['id'] | undefined>;
}) {
    /**
     * Newest first, so a method the customer just added leads the list rather than being buried at the
     * bottom of it.
     */
    const sortedPaymentMethods = computed(() =>
        [...(paymentMethods.value ?? [])].sort(
            (a, b) => toTime(b.created_at) - toTime(a.created_at),
        ),
    );

    watch(
        () =>
            [
                paymentMethods.value,
                preferredPaymentMethodId?.value,
                selectedPaymentMethodId.value,
            ] as const,
        ([methods, preferredId, chosenId], previous) => {
            const previousMethods = previous?.[0];
            const addedPaymentMethod = methods?.find(
                ({ id }) => !previousMethods?.some((previousMethod) => previousMethod.id === id),
            );

            // Only a list that already had methods and then grew means the customer added one. Arriving
            // from nothing is the list loading, where the default should still win.
            if (addedPaymentMethod && previousMethods?.length) {
                selectedPaymentMethodId.value = addedPaymentMethod.id;
                return;
            }

            const isStillOffered = (id?: PaymentMethod['id']) =>
                !!id && !!methods?.some((method) => method.id === id);

            if (isStillOffered(chosenId)) {
                return;
            }

            selectedPaymentMethodId.value = isStillOffered(preferredId)
                ? preferredId
                : (methods?.find(({ is_default }) => is_default) ?? sortedPaymentMethods.value[0])
                      ?.id;
        },
        { immediate: true },
    );

    return { sortedPaymentMethods };
}
