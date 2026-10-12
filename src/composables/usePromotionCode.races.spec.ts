import type { InvoicePreview, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { useInvoicePreview } from './useInvoicePreview';
import { usePromotionCode } from './usePromotionCode';

/**
 * DD-3540 tester: a promotion code whose own preview is taken over by a later one (a seat change,
 * or the checkout's first preview on mount for a host coupon) must still learn whether the code
 * was accepted.
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

describe('DD-3540 tester: promotion code against a superseding preview', () => {
    beforeEach(() => {
        mockGetInvoicePreview.mockReset();
    });

    // Expected failure: the apply's own preview is superseded, so it resolves `undefined` and the
    // apply takes that as accepted; the later preview's rejection is swallowed by its caller.
    it.fails('reports an invalid code when a seat change takes its preview over', async () => {
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
});
