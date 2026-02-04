import { ref } from 'vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';

type PromotionCodeAction = 'apply' | 'remove';

type UsePromotionCodeArgs = {
    checkoutForm: { form: { value: CheckoutFormState } };
    updateInvoicePreviewOnBillingInformationChange: (
        formState: Partial<CheckoutFormState>,
    ) => Promise<unknown>;
    logger?: Logger;
    formatErrorMessage?: (args: { action: PromotionCodeAction; error: unknown }) => string;
    onInvalidPromotionCode?: () => void;
    onApplyError?: () => void;
};

export function usePromotionCode({
    checkoutForm,
    updateInvoicePreviewOnBillingInformationChange,
    logger,
    formatErrorMessage,
    onInvalidPromotionCode,
    onApplyError,
}: UsePromotionCodeArgs) {
    const isPromotionCodePending = ref(false);
    const promotionCodeErrorMessage = ref<string | null>(null);

    const setErrorMessage = (action: PromotionCodeAction, error: unknown) => {
        promotionCodeErrorMessage.value = formatErrorMessage
            ? formatErrorMessage({ action, error })
            : action === 'apply'
              ? 'Promotion code could not be applied. Please try again.'
              : 'Promotion code could not be removed. Please try again.';
    };

    const isInvalidPromotionCodeError = (error: unknown) => {
        return (
            typeof error === 'object' &&
            error !== null &&
            'field' in error &&
            (error as { field?: string }).field === 'promotion_codes'
        );
    };

    const applyPromotionCode = async (code?: string | null) => {
        const normalizedCode = code?.trim();
        if (!normalizedCode) {
            return;
        }

        promotionCodeErrorMessage.value = null;
        checkoutForm.form.value.promotionCode = normalizedCode;
        isPromotionCodePending.value = true;

        try {
            await updateInvoicePreviewOnBillingInformationChange({
                promotionCode: normalizedCode,
            });
        } catch (error) {
            logger?.capture(error, {
                code: 'PROMOTION_CODE_APPLY_FAILED',
                message: 'Failed to apply promotion code',
            });
            setErrorMessage('apply', error);
            onApplyError?.();
            if (isInvalidPromotionCodeError(error)) {
                onInvalidPromotionCode?.();
            }
            await removePromotionCode({ suppressError: true, preserveErrorMessage: true });
        } finally {
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
        if (!preserveErrorMessage) {
            promotionCodeErrorMessage.value = null;
        }
        delete checkoutForm.form.value.promotionCode;
        isPromotionCodePending.value = true;

        try {
            await updateInvoicePreviewOnBillingInformationChange({});
        } catch (error) {
            logger?.capture(error, {
                code: 'PROMOTION_CODE_REMOVE_FAILED',
                message: 'Failed to remove promotion code',
            });
            if (!suppressError) {
                setErrorMessage('remove', error);
            }
        } finally {
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
