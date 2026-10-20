import { ref } from 'vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { isRejectedPromotionCode } from '@/services/apiError';

type PromotionCodeAction = 'apply' | 'remove';

type UsePromotionCodeArgs = {
    checkoutForm: { form: { value: CheckoutFormState } };
    updateInvoicePreviewOnBillingInformationChange: (
        formState: Partial<CheckoutFormState>,
    ) => Promise<unknown>;
    formatErrorMessage?: (args: { action: PromotionCodeAction; error: unknown }) => string;
    onInvalidPromotionCode?: () => void;
    onApplyError?: () => void;
};

export function usePromotionCode({
    checkoutForm,
    updateInvoicePreviewOnBillingInformationChange,
    formatErrorMessage,
    onInvalidPromotionCode,
    onApplyError,
}: UsePromotionCodeArgs) {
    const logger = useLogger();
    const isPromotionCodePending = ref<boolean>(false);
    const promotionCodeErrorMessage = ref<string | null>(null);

    const setErrorMessage = (action: PromotionCodeAction, error: unknown) => {
        promotionCodeErrorMessage.value = formatErrorMessage
            ? formatErrorMessage({ action, error })
            : action === 'apply'
              ? 'Promotion code could not be applied. Please try again.'
              : 'Promotion code could not be removed. Please try again.';
    };

    // An apply or removal settles as the latest preview does, which a later apply or removal may
    // have asked for. Only the one asked for last speaks for the code; an earlier one settles quietly.
    let latestAction = 0;

    const applyPromotionCode = async (code?: string | null) => {
        const normalizedCode = code?.trim();
        if (!normalizedCode) {
            return;
        }

        const action = ++latestAction;
        promotionCodeErrorMessage.value = null;
        checkoutForm.form.value.promotionCode = normalizedCode;
        isPromotionCodePending.value = true;

        try {
            await updateInvoicePreviewOnBillingInformationChange({
                promotionCode: normalizedCode,
            });
        } catch (error) {
            if (action !== latestAction) return;

            const isRejected = isRejectedPromotionCode(error);
            if (isRejected) {
                logger.warn(
                    'PROMOTION_CODE_REJECTED',
                    'The promotion code was not accepted',
                    {},
                    error,
                );
            } else {
                logger.capture(error, {
                    code: 'PROMOTION_CODE_APPLY_FAILED',
                    message: 'Failed to apply promotion code',
                });
            }
            setErrorMessage('apply', error);
            onApplyError?.();
            if (isRejected) {
                onInvalidPromotionCode?.();
            }
            isPromotionCodePending.value = false;
            // The code is off the form at once; the preview without it is the removal's to wait on,
            // so the apply is settled even while that preview is still out.
            void removePromotionCode({ suppressError: true, preserveErrorMessage: true });
            return;
        }
        if (action === latestAction) {
            isPromotionCodePending.value = false;
        }
    };

    const removePromotionCode = async ({
        suppressError = false,
        preserveErrorMessage = false,
    }: {
        suppressError?: boolean;
        preserveErrorMessage?: boolean;
    } = {}) => {
        const action = ++latestAction;
        if (!preserveErrorMessage) {
            promotionCodeErrorMessage.value = null;
        }
        delete checkoutForm.form.value.promotionCode;
        isPromotionCodePending.value = true;

        try {
            await updateInvoicePreviewOnBillingInformationChange({});
        } catch (error) {
            if (action !== latestAction) return;

            logger.capture(error, {
                code: 'PROMOTION_CODE_REMOVE_FAILED',
                message: 'Failed to remove promotion code',
            });
            if (!suppressError) {
                setErrorMessage('remove', error);
            }
        }
        if (action === latestAction) {
            isPromotionCodePending.value = false;
        }
    };

    return {
        applyPromotionCode,
        removePromotionCode,
        isPromotionCodePending,
        promotionCodeErrorMessage,
    };
}
