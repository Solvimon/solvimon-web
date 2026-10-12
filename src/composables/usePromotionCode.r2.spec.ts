import type { InvoicePreview, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { useInvoicePreview } from './useInvoicePreview';
import { usePromotionCode } from './usePromotionCode';

/**
 * DD-3540 tester, round 2: an apply now settles as the preview asked for last does. That preview
 * need not carry the code the apply is about.
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

describe('DD-3540 tester r2: an apply settled by a preview without its code', () => {
    beforeEach(() => {
        mockGetInvoicePreview.mockReset();
    });

    // Expected failure (low): the apply settles as the removal's failed preview does, so it says
    // "could not be applied" over the removal's own message and starts a second removal.
    it.fails('says nothing about a code the customer removed while it was applying', async () => {
        const { pending, form, promo } = setup();

        const apply = promo.applyPromotionCode('SUMMER');
        const remove = promo.removePromotionCode();

        pending[1]!.reject(serverError);
        pending[0]!.resolve(preview('inv_summer'));
        await apply;
        await remove;

        // The removal's own failure is the one thing worth saying.
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
