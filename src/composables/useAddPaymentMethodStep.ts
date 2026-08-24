import { computed, ref, type Ref } from 'vue';

/** Whatever renders the pane — the pane itself, or a shell that passes these through. */
type AddPaymentMethodHost = {
    submit: () => void;
    isSaving: boolean;
};

/**
 * Adding a payment method as a detour from whatever the customer came to do.
 *
 * Both wallet modals keep every pane mounted and step sideways to one for adding a method, then back
 * to where they were — including the part that is easy to get wrong: the pane owns the request, so
 * only it knows whether one is out, and the host has to ask before letting anyone leave.
 */
export function useAddPaymentMethodStep<TStep extends string>({
    step,
    name,
    returnTo,
}: {
    step: Ref<TStep>;
    name: TStep;
    returnTo: TStep;
}) {
    const paneRef = ref<AddPaymentMethodHost>();

    return {
        paneRef,
        isActive: computed(() => step.value === name),
        isSaving: computed(() => !!paneRef.value?.isSaving),
        open: () => {
            step.value = name;
        },
        leave: () => {
            step.value = returnTo;
        },
        submit: () => paneRef.value?.submit(),
    };
}
