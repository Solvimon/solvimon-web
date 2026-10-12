import { flushPromises, mount } from '@vue/test-utils';
import { computed, ref } from 'vue';
import type { PortalUrl } from '@/services/portals.types';
import Checkout from './Checkout.vue';

const { state } = vi.hoisted(() => ({
    state: {
        invoicePreview: undefined as unknown,
        trialInvoicePreview: undefined as unknown,
        recurringAmount: undefined as unknown,
        hasOneOffCharges: false,
    },
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        useTimePeriod: () => ({ formatTimePeriod: () => 'a month' }),
    });
});

vi.mock('./useCheckout.view', async () => {
    const { ref: r, computed: c } = await import('vue');

    return {
        useCheckoutView: () => ({
            paymentMethodOptions: r([]),
            subscription: r({
                id: 'sub_1',
                billing_period: 'MONTHLY',
                pricing_plan_schedule_infos: [],
            }),
            isPaymentMethodsPending: r(false),
            isInvoicePreviewPending: r(false),
            checkoutForm: {
                form: r({ country: 'US', enabledPricingIds: [], seatsValues: [] }),
                initialState: r({ seatsValues: [] }),
                validation: r({ $validate: vi.fn(), $invalid: false }),
                getIsFieldRequired: () => false,
                updateInitialState: vi.fn(),
            },
            invoicePreview: c(() => state.invoicePreview),
            invoicePreviewByBillingPeriod: r({}),
            trialInvoicePreview: c(() => state.trialInvoicePreview),
            trialPeriod: r({ type: 'MONTH', value: 1 }),
            authorizationContext: r(undefined),
            isPaid: r(false),
            amount: r({ currency: 'USD', quantity: '10.00' }),
            recurringAmount: c(() => state.recurringAmount),
            hasOneOffCharges: c(() => state.hasOneOffCharges),
            loadInvoicePreview: vi.fn(),
            updateInvoicePreviewOnBillingInformationChange: vi.fn(),
            saveFormStateForRedirect: vi.fn(),
        }),
    };
});

vi.mock('@/composables/usePromotionCode', () => ({
    usePromotionCode: () => ({
        promotionCodeErrorMessage: ref(null),
        applyPromotionCode: vi.fn(),
        removePromotionCode: vi.fn(),
        isPromotionCodePending: ref(false),
    }),
}));

vi.mock('@/composables/useAutoApplyPromotionCode', () => ({
    useAutoApplyPromotionCode: () => ({ autoAppliedCode: ref(undefined) }),
}));

vi.mock('@/composables/useViewport', () => ({
    useViewport: () => ({ isMobileViewport: computed(() => false) }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

vi.mock(
    '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature',
    () => ({ useExperimentalFeature: () => ({ value: { 'express-checkout': true } }) }),
);

const PORTAL = {
    object_type: 'PORTAL_URL',
    id: 'purl_checkout',
    type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
    status: 'PUBLISHED',
    token: 'test-portal-token',
    init_pricing_plan_subscription: { pricing_plan_subscription_id: 'sub_1' },
} as unknown as PortalUrl;

vi.mock('@/components/providers/PortalProvider/composables/usePortal', () => ({
    usePortal: () => ref(PORTAL),
}));

const STUBBED_CHILDREN = [
    'Button',
    'CheckoutForm',
    'CheckoutNotAvailable',
    'CheckoutTitle',
    'EmptyStatePlaceholder',
    'ErrorNotification',
    'ExpressPaymentMethods',
    'OrderSummary',
    'PaymentIntegrationForm',
    'PlanCustomizationEditor',
    'PromotionCodeSection',
    'SecurePaymentsKPI',
    'Skeleton',
    'SubscriptionPaymentCompletedCard',
    'Typography',
];

const usd = (quantity: unknown) => ({ currency: 'USD', quantity });

const anInvoice = (quantity: unknown) => ({
    id: 'inv_preview',
    periods: [{ start_at: '2026-10-09T00:00:00.000Z' }],
    billing_period: { type: 'MONTH', value: 1 },
    invoice_amount_including_tax: usd(quantity),
    tax_summary: { total_amount: usd(quantity) },
});

const agreementOf = async () => {
    const wrapper = mount(Checkout, {
        global: { stubs: Object.fromEntries(STUBBED_CHILDREN.map((name) => [name, true])) },
    });
    await flushPromises();
    await vi.dynamicImportSettled();

    const info = wrapper
        .findComponent({ name: 'ExpressPaymentMethods' })
        .props('billingInformation') as { agreement?: string } | undefined;

    return info?.agreement ?? '';
};

describe('Checkout agreement (DD-3553)', () => {
    beforeEach(() => {
        state.invoicePreview = anInvoice('20.00');
        state.trialInvoicePreview = undefined;
        state.recurringAmount = usd('20.00');
        state.hasOneOffCharges = false;
    });

    it.each(['0', '0.0', '0.00', 0, '0.000'])('calls a trial of %j free', async (quantity) => {
        state.trialInvoicePreview = anInvoice(quantity);

        expect(await agreementOf()).toMatch(/^Free for a month/);
    });

    it.each(['0.01', '1', '-0.01'])('does not call a trial of %j free', async (quantity) => {
        state.trialInvoicePreview = anInvoice(quantity);

        expect(await agreementOf()).not.toMatch(/Free/);
    });

    it('states a non-EUR trial checkout in its own currency only', async () => {
        state.trialInvoicePreview = anInvoice('0.00');

        const agreement = await agreementOf();

        expect(agreement).toContain('$20.00');
        expect(agreement).not.toMatch(/EUR|€/);
    });

    it('states a non-EUR one-off checkout in its own currency only', async () => {
        state.hasOneOffCharges = true;
        state.invoicePreview = anInvoice('30.00');
        state.recurringAmount = usd('0.00');

        const agreement = await agreementOf();

        expect(agreement).toContain('$30.00');
        expect(agreement).not.toMatch(/EUR|€/);
    });
});
