import type { InvoicePreview, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useInvoicePreview } from './useInvoicePreview';
import { usePromotionCode } from './usePromotionCode';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import { providerMockLogger } from '@/test-utils/providerMock';

type Args = Parameters<typeof usePromotionCode>[0];

const { mockGetInvoicePreview } = vi.hoisted(() => ({ mockGetInvoicePreview: vi.fn() }));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: vi.fn(() => ({ getInvoicePreview: mockGetInvoicePreview })),
}));

const subscription = {
    id: 'sub_1',
    pricing_plan_schedule_infos: [{ id: 'ppsc_1', pricing_plan_schedule: { type: 'DEFAULT' } }],
    billing_period: { type: 'MONTH', value: 1 },
} as unknown as PricingPlanSubscriptionExpanded;

const preview = (id: string) =>
    ({
        first_invoice: { id },
        invoice_infos: [{ pricing_plan_schedule_id: 'ppsc_1', invoices: [{ id }] }],
    }) as unknown as InvoicePreview;

const invalidCode = { message: 'Unknown promotion code', field: 'promotion_codes' };
const serverError = { message: 'Server error' };

function setup() {
    const pending: { resolve: (p: InvoicePreview) => void; reject: (e: unknown) => void }[] = [];
    mockGetInvoicePreview.mockImplementation(
        () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    );

    const form = ref<CheckoutFormState>({
        type: 'INDIVIDUAL',
        country: 'NL',
        seatsValues: [{ pricing_item_config_id: 'pic_1', number: '1' }],
    } as unknown as CheckoutFormState);

    const invoicePreview = useInvoicePreview();
    const load = (state: Partial<CheckoutFormState>) =>
        invoicePreview.loadInvoicePreview({
            subscription,
            customer: { type: 'INDIVIDUAL' },
            seatsValues: state.seatsValues,
            promotionCode: state.promotionCode,
        });

    const promo = usePromotionCode({
        checkoutForm: { form },
        updateInvoicePreviewOnBillingInformationChange: (state) =>
            load({ ...form.value, ...state }),
    });

    return { pending, form, invoicePreview, load, promo };
}

describe('usePromotionCode against a superseding preview', () => {
    beforeEach(() => {
        mockGetInvoicePreview.mockReset();
    });

    it('reports an invalid code when a seat change takes its preview over', async () => {
        const { pending, form, load, promo } = setup();

        const apply = promo.applyPromotionCode('NOPE');
        form.value.seatsValues = [{ pricing_item_config_id: 'pic_1', number: '2' }];
        const seatChange = load(form.value).catch(() => {});

        pending[0]!.reject(invalidCode);
        pending[1]!.reject(invalidCode);
        await apply;
        await seatChange;

        expect(promo.promotionCodeErrorMessage.value).not.toBeNull();
        expect(form.value.promotionCode).toBeUndefined();
    });

    it('keeps a valid code when a seat change takes its preview over', async () => {
        const { pending, form, load, promo, invoicePreview } = setup();

        const apply = promo.applyPromotionCode('SUMMER');
        form.value.seatsValues = [{ pricing_item_config_id: 'pic_1', number: '2' }];
        const seatChange = load(form.value);

        pending[1]!.resolve(preview('inv_seats_2_summer'));
        pending[0]!.resolve(preview('inv_seats_1_summer'));
        await apply;
        await seatChange;

        expect(promo.promotionCodeErrorMessage.value).toBeNull();
        expect(form.value.promotionCode).toBe('SUMMER');
        expect(invoicePreview.invoicePreview.value).toEqual({ id: 'inv_seats_2_summer' });
    });

    // The code would show as applied over a preview that failed, priced on the one before it.
    it('does not keep a code whose preview was taken over by one that failed', async () => {
        const { pending, form, load, promo } = setup();

        const apply = promo.applyPromotionCode('SUMMER');
        form.value.seatsValues = [{ pricing_item_config_id: 'pic_1', number: '2' }];
        const seatChange = load(form.value).catch(() => {});

        pending[0]!.resolve(preview('inv_seats_1_summer'));
        pending[1]!.reject(new Error('Network down'));
        await apply;
        await seatChange;

        expect(promo.promotionCodeErrorMessage.value).not.toBeNull();
        expect(form.value.promotionCode).toBeUndefined();
    });
});

describe('usePromotionCode settled by a later preview without its code', () => {
    beforeEach(() => {
        mockGetInvoicePreview.mockReset();
    });

    it('says nothing about a code the customer removed while it was applying', async () => {
        const { pending, form, promo } = setup();

        const apply = promo.applyPromotionCode('SUMMER');
        const remove = promo.removePromotionCode();

        pending[1]!.reject(serverError);
        pending[0]!.resolve(preview('inv_summer'));
        await apply;
        await remove;

        expect(promo.promotionCodeErrorMessage.value).toBe(
            'Promotion code could not be removed. Please try again.',
        );
        expect(form.value.promotionCode).toBeUndefined();
        // The apply's failure starts no removal of its own on top of the customer's.
        expect(mockGetInvoicePreview).toHaveBeenCalledTimes(2);
    });

    it('settles quietly when the customer removed the code and changed seats', async () => {
        const { pending, form, load, promo } = setup();

        const apply = promo.applyPromotionCode('SUMMER');
        const remove = promo.removePromotionCode();
        form.value.seatsValues = [{ pricing_item_config_id: 'pic_1', number: '4' }];
        const seats = load(form.value);

        pending[2]!.resolve(preview('inv_seats_4'));
        pending[1]!.resolve(preview('inv_removed'));
        pending[0]!.resolve(preview('inv_summer'));
        await Promise.all([apply, remove, seats]);

        expect(promo.promotionCodeErrorMessage.value).toBeNull();
        expect(form.value.promotionCode).toBeUndefined();
        expect(promo.isPromotionCodePending.value).toBe(false);
    });

    it('ends on the code after a rapid apply, remove, apply', async () => {
        const { pending, form, promo, invoicePreview } = setup();

        const first = promo.applyPromotionCode('SUMMER');
        const remove = promo.removePromotionCode();
        const second = promo.applyPromotionCode('SUMMER');

        pending[2]!.resolve(preview('inv_summer_2'));
        pending[1]!.resolve(preview('inv_removed'));
        pending[0]!.resolve(preview('inv_summer_1'));
        await Promise.all([first, remove, second]);

        expect(form.value.promotionCode).toBe('SUMMER');
        expect(promo.promotionCodeErrorMessage.value).toBeNull();
        expect(promo.isPromotionCodePending.value).toBe(false);
        expect(invoicePreview.invoicePreview.value).toEqual({ id: 'inv_summer_2' });
    });

    it('keeps pending on while the removal after a refused code is out', async () => {
        const { pending, promo, invoicePreview } = setup();

        const apply = promo.applyPromotionCode('NOPE');
        pending[0]!.reject(invalidCode);
        await apply;

        expect(mockGetInvoicePreview).toHaveBeenCalledTimes(2);
        expect(promo.isPromotionCodePending.value).toBe(true);
        expect(invoicePreview.isPending.value).toBe(true);

        pending[1]!.resolve(preview('inv_without'));
        await vi.waitFor(() => expect(promo.isPromotionCodePending.value).toBe(false));
        expect(invoicePreview.invoicePreview.value).toEqual({ id: 'inv_without' });
        expect(promo.promotionCodeErrorMessage.value).not.toBeNull();
    });
});

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
function mountPromotionCode(
    overrides: Partial<Args> = {},
    initialForm: Partial<CheckoutFormState> = {},
) {
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
            const { applyPromotionCode, checkoutForm, updateInvoicePreview } = mountPromotionCode();

            await applyPromotionCode('  WELCOME10 ');

            expect(checkoutForm.form.value.promotionCode).toBe('WELCOME10');
            expect(updateInvoicePreview).toHaveBeenCalledExactlyOnceWith({
                promotionCode: 'WELCOME10',
            });
        });

        it.each([undefined, null, '', '   '])('ignores an empty code (%j)', async (code) => {
            const { applyPromotionCode, checkoutForm, updateInvoicePreview } = mountPromotionCode();

            await applyPromotionCode(code);

            expect(updateInvoicePreview).not.toHaveBeenCalled();
            expect(checkoutForm.form.value).not.toHaveProperty('promotionCode');
        });

        it('is pending while the preview is loading and not after', async () => {
            const pending = deferred();
            const { applyPromotionCode, isPromotionCodePending, updateInvoicePreview } =
                mountPromotionCode();
            updateInvoicePreview.mockReturnValueOnce(pending.promise);

            const applying = applyPromotionCode('WELCOME10');
            expect(isPromotionCodePending.value).toBe(true);

            pending.resolve();
            await applying;
            expect(isPromotionCodePending.value).toBe(false);
        });

        it('clears an earlier error when a new code is applied', async () => {
            const { applyPromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                mountPromotionCode();
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
            } = mountPromotionCode();
            updateInvoicePreview.mockRejectedValueOnce(new Error('boom'));

            await applyPromotionCode('BAD');

            expect(updateInvoicePreview).toHaveBeenNthCalledWith(1, { promotionCode: 'BAD' });
            expect(updateInvoicePreview).toHaveBeenNthCalledWith(2, {});
            expect(checkoutForm.form.value).not.toHaveProperty('promotionCode');
            expect(isPromotionCodePending.value).toBe(false);
        });

        it('shows the default apply message and logs the failure', async () => {
            const error = new Error('boom');
            const { applyPromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                mountPromotionCode();
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
            const { applyPromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                mountPromotionCode();
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
            const { applyPromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                mountPromotionCode({
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
            const { applyPromotionCode, updateInvoicePreview } = mountPromotionCode({
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
            const { applyPromotionCode } = mountPromotionCode({
                onApplyError,
                onInvalidPromotionCode,
            });

            await applyPromotionCode('WELCOME10');

            expect(onApplyError).not.toHaveBeenCalled();
            expect(onInvalidPromotionCode).not.toHaveBeenCalled();
            expect(providerMockLogger.capture).not.toHaveBeenCalled();
        });
    });

    describe('removePromotionCode', () => {
        it('takes the code off the form and reprices without it', async () => {
            const { removePromotionCode, checkoutForm, updateInvoicePreview } = mountPromotionCode(
                {},
                {
                    promotionCode: 'WELCOME10',
                } as Partial<CheckoutFormState>,
            );

            await removePromotionCode();

            expect(checkoutForm.form.value).not.toHaveProperty('promotionCode');
            expect(updateInvoicePreview).toHaveBeenCalledExactlyOnceWith({});
        });

        it('is pending while the preview is loading and not after', async () => {
            const pending = deferred();
            const { removePromotionCode, isPromotionCodePending, updateInvoicePreview } =
                mountPromotionCode();
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
            } = mountPromotionCode();
            updateInvoicePreview.mockRejectedValueOnce(new Error('boom'));
            await applyPromotionCode('BAD');

            await removePromotionCode();

            expect(promotionCodeErrorMessage.value).toBeNull();
        });

        it('shows the default remove message and logs the failure', async () => {
            const error = new Error('boom');
            const { removePromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                mountPromotionCode();
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
            const { removePromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                mountPromotionCode({
                    formatErrorMessage,
                });
            updateInvoicePreview.mockRejectedValueOnce(error);

            await removePromotionCode();

            expect(formatErrorMessage).toHaveBeenCalledExactlyOnceWith({ action: 'remove', error });
            expect(promotionCodeErrorMessage.value).toBe('Could not remove');
        });

        it('stays silent on failure when asked to suppress the error', async () => {
            const { removePromotionCode, promotionCodeErrorMessage, updateInvoicePreview } =
                mountPromotionCode();
            updateInvoicePreview.mockRejectedValueOnce(new Error('boom'));

            await removePromotionCode({ suppressError: true });

            expect(promotionCodeErrorMessage.value).toBeNull();
            expect(providerMockLogger.capture).toHaveBeenCalledTimes(1);
        });
    });
});
