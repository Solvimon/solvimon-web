import type { InvoicePreview, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { useInvoicePreview } from './useInvoicePreview';
import { usePromotionCode } from './usePromotionCode';

/**
 * DD-3540 tester, round 3: only the promotion-code action asked for last speaks for the code, in
 * orders the earlier rounds did not try.
 */

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

const serverError = { message: 'Server error' };

async function settle() {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('DD-3540 tester r3: promotion code actions in new orders', () => {
    beforeEach(() => {
        mockGetInvoicePreview.mockReset();
    });

    it('apply X then a refused Y: ends with no code, an error, and pending off', async () => {
        const { pending, form, promo } = setup();

        void promo.applyPromotionCode('SUMMER');
        void promo.applyPromotionCode('NOPE');
        pending[1]!.reject(invalidCode);
        pending[0]!.resolve(preview('inv_summer'));
        await settle();
        pending[2]!.resolve(preview('inv_none'));
        await settle();

        expect(form.value.promotionCode).toBeUndefined();
        expect(promo.promotionCodeErrorMessage.value).not.toBeNull();
        expect(promo.isPromotionCodePending.value).toBe(false);
    });

    it('a refused X then a valid Y: ends on Y, no error, pending off', async () => {
        const { pending, form, promo } = setup();

        void promo.applyPromotionCode('NOPE');
        void promo.applyPromotionCode('SUMMER');
        pending[0]!.reject(invalidCode);
        await settle();
        pending[1]!.resolve(preview('inv_summer'));
        await settle();

        expect(form.value.promotionCode).toBe('SUMMER');
        expect(promo.promotionCodeErrorMessage.value).toBeNull();
        expect(promo.isPromotionCodePending.value).toBe(false);
        expect(mockGetInvoicePreview).toHaveBeenCalledTimes(2);
    });

    it('apply, a seat change, then remove: ends with no code, no error, pending off', async () => {
        const { pending, form, load, promo } = setup();

        void promo.applyPromotionCode('NOPE');
        form.value.seatsValues = [{ pricing_item_config_id: 'pic_1', number: '4' }];
        void load(form.value).catch(() => {});
        void promo.removePromotionCode();

        pending[2]!.resolve(preview('inv_seats_4'));
        pending[1]!.reject(invalidCode);
        pending[0]!.reject(invalidCode);
        await settle();

        expect(form.value.promotionCode).toBeUndefined();
        expect(promo.promotionCodeErrorMessage.value).toBeNull();
        expect(promo.isPromotionCodePending.value).toBe(false);
        expect(mockGetInvoicePreview).toHaveBeenCalledTimes(3);
    });

    it('a host coupon refused on mount while the customer applies another', async () => {
        const { pending, form, load, promo } = setup();

        // Auto-apply, then the checkout's own first preview with the coupon in the form.
        void promo.applyPromotionCode('NOPE');
        void load(form.value).catch(() => {});
        void promo.applyPromotionCode('SUMMER');

        pending[0]!.reject(invalidCode);
        pending[1]!.reject(invalidCode);
        await settle();
        expect(promo.isPromotionCodePending.value).toBe(true);
        pending[2]!.resolve(preview('inv_summer'));
        await settle();

        expect(form.value.promotionCode).toBe('SUMMER');
        expect(promo.promotionCodeErrorMessage.value).toBeNull();
        expect(promo.isPromotionCodePending.value).toBe(false);
    });

    it('remove, then apply, with the removal failing late: ends on the code', async () => {
        const { pending, form, promo } = setup();

        void promo.removePromotionCode();
        void promo.applyPromotionCode('SUMMER');
        pending[1]!.resolve(preview('inv_summer'));
        await settle();
        pending[0]!.reject(serverError);
        await settle();

        expect(form.value.promotionCode).toBe('SUMMER');
        expect(promo.promotionCodeErrorMessage.value).toBeNull();
        expect(promo.isPromotionCodePending.value).toBe(false);
    });

    it('drops the error of a refused code once another is applied during its removal', async () => {
        const { pending, form, promo } = setup();

        void promo.applyPromotionCode('NOPE');
        pending[0]!.reject(invalidCode);
        await settle();
        expect(promo.promotionCodeErrorMessage.value).not.toBeNull();

        void promo.applyPromotionCode('SUMMER');
        pending[2]!.resolve(preview('inv_summer'));
        pending[1]!.reject(serverError);
        await settle();

        expect(form.value.promotionCode).toBe('SUMMER');
        expect(promo.promotionCodeErrorMessage.value).toBeNull();
        expect(promo.isPromotionCodePending.value).toBe(false);
    });
});
