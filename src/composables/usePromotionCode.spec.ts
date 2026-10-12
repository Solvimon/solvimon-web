import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { usePromotionCode } from './usePromotionCode';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import { providerMockLogger } from '@/test-utils/providerMock';

type Args = Parameters<typeof usePromotionCode>[0];

function deferred() {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

// usePromotionCode imports useLogger from the LoggerProvider directly, which the global
// '@/components/providers' mock does not reach, so the logger is provided instead.
function setup(overrides: Partial<Args> = {}, initialForm: Partial<CheckoutFormState> = {}) {
    const checkoutForm = { form: ref({ ...initialForm } as CheckoutFormState) };
    const updateInvoicePreview = vi.fn<Args['updateInvoicePreviewOnBillingInformationChange']>(() =>
        Promise.resolve(),
    );
    let result!: ReturnType<typeof usePromotionCode>;

    mount(
        defineComponent({
            setup() {
                result = usePromotionCode({
                    checkoutForm,
                    updateInvoicePreviewOnBillingInformationChange: updateInvoicePreview,
                    ...overrides,
                });
                return () => h('div');
            },
        }),
        { global: { provide: { [LOGGER_PROVIDER_INJECTION_KEY as symbol]: providerMockLogger } } },
    );

    return { ...result, checkoutForm, updateInvoicePreview };
}

describe('usePromotionCode', () => {
    describe('applyPromotionCode', () => {
        it('puts the trimmed code on the form and previews the invoice with it', async () => {
            const { applyPromotionCode, checkoutForm, updateInvoicePreview } = setup();

            await applyPromotionCode('  WELCOME10 ');

            expect(checkoutForm.form.value.promotionCode).toBe('WELCOME10');
            expect(updateInvoicePreview).toHaveBeenCalledExactlyOnceWith({
                promotionCode: 'WELCOME10',
            });
        });

        it.each([undefined, null, '', '   '])('ignores an empty code (%j)', async (code) => {
            const { applyPromotionCode, checkoutForm, updateInvoicePreview } = setup();

            await applyPromotionCode(code);

            expect(updateInvoicePreview).not.toHaveBeenCalled();
            expect(checkoutForm.form.value).not.toHaveProperty('promotionCode');
        });

        it('is pending while the preview is loading and not after', async () => {
            const pending = deferred();
            const { applyPromotionCode, isPromotionCodePending, updateInvoicePreview } = setup();
            updateInvoicePreview.mockReturnValueOnce(pending.promise);

            const applying = applyPromotionCode('WELCOME10');
            expect(isPromotionCodePending.value).toBe(true);

            pending.resolve();
            await applying;
            expect(isPromotionCodePending.value).toBe(false);
        });

        it('clears an earlier error when a new code is applied', async () => {
            const { applyPromotionCode, promotionCodeErrorMessage, updateInvoicePreview } = setup();
            updateInvoicePreview.mockRejectedValueOnce(new Error('boom'));
            await applyPromotionCode('BAD');
            expect(promotionCodeErrorMessage.value).not.toBeNull();

            await applyPromotionCode('GOOD');

            expect(promotionCodeErrorMessage.value).toBeNull();
        });

        it('takes the code back off and reprices without it when applying fails', async () => {
            const {
                applyPromotionCode,
                checkoutForm,
                updateInvoicePreview,
                isPromotionCodePending,
            } = setup();
            updateInvoicePreview.mockRejectedValueOnce(new Error('boom'));

            await applyPromotionCode('BAD');

            expect(updateInvoicePreview).toHaveBeenNthCalledWith(1, { promotionCode: 'BAD' });
            expect(updateInvoicePreview).toHaveBeenNthCalledWith(2, {});
            expect(checkoutForm.form.value).not.toHaveProperty('promotionCode');
            expect(isPromotionCodePending.value).toBe(false);
        });

        it('shows the default apply message and logs the failure', async () => {
            const error = new Error('boom');
            const { applyPromotionCode, promotionCodeErrorMessage, updateInvoicePreview } = setup();
            updateInvoicePreview.mockRejectedValueOnce(error);

            await applyPromotionCode('BAD');

            expect(promotionCodeErrorMessage.value).toBe(
                'Promotion code could not be applied. Please try again.',
            );
            expect(providerMockLogger.capture).toHaveBeenCalledExactlyOnceWith(error, {
                code: 'PROMOTION_CODE_APPLY_FAILED',
                message: 'Failed to apply promotion code',
            });
        });

        it('keeps the apply message even when the clean-up reprice also fails', async () => {
            const { applyPromotionCode, promotionCodeErrorMessage, updateInvoicePreview } = setup();
            updateInvoicePreview
                .mockRejectedValueOnce(new Error('apply'))
                .mockRejectedValueOnce(new Error('remove'));

            await applyPromotionCode('BAD');

            expect(promotionCodeErrorMessage.value).toBe(
                'Promotion code could not be applied. Please try again.',
            );
            expect(providerMockLogger.capture).toHaveBeenCalledTimes(2);
            expect(providerMockLogger.capture).toHaveBeenLastCalledWith(expect.any(Error), {
                code: 'PROMOTION_CODE_REMOVE_FAILED',
                message: 'Failed to remove promotion code',
            });
        });

        it('lets the caller word the error', async () => {
            const error = { field: 'promotion_codes' };
            const formatErrorMessage = vi.fn(() => 'That code does not exist');
            const { applyPromotionCode, promotionCodeErrorMessage, updateInvoicePreview } = setup({
                formatErrorMessage,
            });
            updateInvoicePreview.mockRejectedValueOnce(error);

            await applyPromotionCode('NOPE');

            expect(formatErrorMessage).toHaveBeenCalledExactlyOnceWith({ action: 'apply', error });
            expect(promotionCodeErrorMessage.value).toBe('That code does not exist');
        });

        it('reports an invalid code only when the API rejects the promotion code field', async () => {
            const onApplyError = vi.fn();
            const onInvalidPromotionCode = vi.fn();
            const { applyPromotionCode, updateInvoicePreview } = setup({
                onApplyError,
                onInvalidPromotionCode,
            });

            updateInvoicePreview.mockRejectedValueOnce({ field: 'promotion_codes' });
            await applyPromotionCode('NOPE');
            expect(onApplyError).toHaveBeenCalledTimes(1);
            expect(onInvalidPromotionCode).toHaveBeenCalledTimes(1);

            updateInvoicePreview.mockRejectedValueOnce({ field: 'email' });
            await applyPromotionCode('NOPE');
            updateInvoicePreview.mockRejectedValueOnce(new Error('network'));
            await applyPromotionCode('NOPE');
            expect(onApplyError).toHaveBeenCalledTimes(3);
            expect(onInvalidPromotionCode).toHaveBeenCalledTimes(1);
        });

        it('does not call the error callbacks when applying succeeds', async () => {
            const onApplyError = vi.fn();
            const onInvalidPromotionCode = vi.fn();
            const { applyPromotionCode } = setup({ onApplyError, onInvalidPromotionCode });

            await applyPromotionCode('WELCOME10');

            expect(onApplyError).not.toHaveBeenCalled();
            expect(onInvalidPromotionCode).not.toHaveBeenCalled();
            expect(providerMockLogger.capture).not.toHaveBeenCalled();
        });
    });

    describe('removePromotionCode', () => {
        it('takes the code off the form and reprices without it', async () => {
            const { removePromotionCode, checkoutForm, updateInvoicePreview } = setup({}, {
                promotionCode: 'WELCOME10',
            } as Partial<CheckoutFormState>);

            await removePromotionCode();

            expect(checkoutForm.form.value).not.toHaveProperty('promotionCode');
            expect(updateInvoicePreview).toHaveBeenCalledExactlyOnceWith({});
        });

        it('is pending while the preview is loading and not after', async () => {
            const pending = deferred();
            const { removePromotionCode, isPromotionCodePending, updateInvoicePreview } = setup();
            updateInvoicePreview.mockReturnValueOnce(pending.promise);

            const removing = removePromotionCode();
            expect(isPromotionCodePending.value).toBe(true);

            pending.reject(new Error('boom'));
            await removing;
            expect(isPromotionCodePending.value).toBe(false);
        });

        it('clears an earlier error before removing', async () => {
            const {
                applyPromotionCode,
                removePromotionCode,
                promotionCodeErrorMessage,
                updateInvoicePreview,
            } = setup();
            updateInvoicePreview.mockRejectedValueOnce(new Error('boom'));
            await applyPromotionCode('BAD');

            await removePromotionCode();

            expect(promotionCodeErrorMessage.value).toBeNull();
        });

        it('shows the default remove message and logs the failure', async () => {
            const error = new Error('boom');
            const { removePromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                setup();
            updateInvoicePreview.mockRejectedValueOnce(error);

            await removePromotionCode();

            expect(promotionCodeErrorMessage.value).toBe(
                'Promotion code could not be removed. Please try again.',
            );
            expect(providerMockLogger.capture).toHaveBeenCalledExactlyOnceWith(error, {
                code: 'PROMOTION_CODE_REMOVE_FAILED',
                message: 'Failed to remove promotion code',
            });
        });

        it('passes the remove action to a caller-supplied formatter', async () => {
            const error = new Error('boom');
            const formatErrorMessage = vi.fn(() => 'Could not remove');
            const { removePromotionCode, promotionCodeErrorMessage, updateInvoicePreview } = setup({
                formatErrorMessage,
            });
            updateInvoicePreview.mockRejectedValueOnce(error);

            await removePromotionCode();

            expect(formatErrorMessage).toHaveBeenCalledExactlyOnceWith({ action: 'remove', error });
            expect(promotionCodeErrorMessage.value).toBe('Could not remove');
        });

        it('stays silent on failure when asked to suppress the error', async () => {
            const { removePromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                setup();
            updateInvoicePreview.mockRejectedValueOnce(new Error('boom'));

            await removePromotionCode({ suppressError: true });

            expect(promotionCodeErrorMessage.value).toBeNull();
            expect(providerMockLogger.capture).toHaveBeenCalledTimes(1);
        });
    });
});
