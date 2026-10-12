import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';

/**
 * Whether the payment form is held — dimmed, and out of reach of the pointer — while a payment is
 * on its way, so the customer cannot change what is being paid with.
 *
 * Not while the gateway is waiting on the customer: Adyen draws a 3DS challenge, a QR code and the
 * like inside the form, and a held form would leave the customer unable to reach it. The pay
 * button stays off either way; the form itself takes one payment at a time.
 */
export function usePaymentFormHold(isPaymentPending: Ref<boolean>): {
    isFormHeld: ComputedRef<boolean>;
    handleActionRequired: () => void;
} {
    const isAwaitingCustomer = ref(false);

    watch(
        isPaymentPending,
        (isPending) => {
            if (!isPending) isAwaitingCustomer.value = false;
        },
        { flush: 'sync' },
    );

    return {
        isFormHeld: computed(() => isPaymentPending.value && !isAwaitingCustomer.value),
        handleActionRequired: () => {
            isAwaitingCustomer.value = true;
        },
    };
}
