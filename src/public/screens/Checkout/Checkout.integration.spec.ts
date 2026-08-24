import { flushPromises, mount } from '@vue/test-utils';
import { computed, ref } from 'vue';
import type { PortalUrl } from '@/services/portals.types';
import Checkout from './Checkout.vue';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { isPaid, subscription, invoicePreview, SEATS_VALUES } = vi.hoisted(() => ({
    isPaid: { value: false },
    subscription: { value: undefined as unknown },
    invoicePreview: { value: undefined as unknown },
    /** Seats to set are the plainest reason for the editor to be on screen at all. */
    SEATS_VALUES: [{ pricingItemConfigId: 'pic_1', value: 1 }],
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    // `useTimePeriod` reaches for the intl provider, which a bare mount does not set up.
    return createSolvimonUiMock({
        useTimePeriod: () => ({ formatTimePeriod: () => 'a month' }),
    });
});

/**
 * The screen leans on its view composable for everything it renders, so it is the one thing that has
 * to be steered: the fields below are what the template reads to decide what to show.
 */
vi.mock('./useCheckout.view', async () => {
    const { ref: r, computed: c } = await import('vue');

    return {
        useCheckoutView: () => ({
            paymentMethodOptions: r([]),
            subscription: c(() => subscription.value),
            isPaymentMethodsPending: r(false),
            isInvoicePreviewPending: r(false),
            checkoutForm: {
                form: r({ country: 'NL', enabledPricingIds: [], seatsValues: SEATS_VALUES }),
                initialState: r({ seatsValues: SEATS_VALUES }),
                validation: r({ $validate: vi.fn(), $invalid: false }),
                getIsFieldRequired: () => false,
            },
            invoicePreview: c(() => invoicePreview.value),
            invoicePreviewByBillingPeriod: r({}),
            trialInvoicePreview: r(undefined),
            trialPeriod: r(undefined),
            authorizationContext: r(undefined),
            isPaid: c({
                get: () => isPaid.value,
                set: (value: boolean) => (isPaid.value = value),
            }),
            amount: r({ currency: 'EUR', quantity: '10.00' }),
            loadInvoicePreview: vi.fn(),
            updateInvoicePreviewOnBillingInformationChange: vi.fn(),
            saveFormStateForRedirect: vi.fn(),
        }),
    };
});

vi.mock('@/composables/usePromotionCode', () => ({
    usePromotionCode: () => ({
        promotionCode: ref(undefined),
        promotionCodeErrorMessage: ref(undefined),
        applyPromotionCode: vi.fn(),
        removePromotionCode: vi.fn(),
        isPending: computed(() => false),
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

const PORTAL = {
    object_type: 'PORTAL_URL',
    id: 'purl_checkout',
    type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
    status: 'PUBLISHED',
    token: 'test-portal-token',
    init_pricing_plan_subscription: {
        pricing_plan_subscription_id: 'sub_1',
        success_url: undefined,
    },
} as unknown as PortalUrl;

vi.mock('@/components/providers/PortalProvider/composables/usePortal', () => ({
    usePortal: () => ref(PORTAL),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CUSTOMISABLE_SUBSCRIPTION = {
    id: 'sub_1',
    billing_period: 'MONTHLY',
    pricing_plan_schedule_infos: [],
} as unknown;

/**
 * Every child is stubbed but the layout, which owns the slots the rest is rendered into — a stub
 * renders no slots, so stubbing it would mount the screen empty and let the assertions below pass for
 * the wrong reason. `shallow` cannot express that: the layout has no script block, so it carries no
 * name for `stubs` to exempt it by. It is a template and nothing else, so rendering it costs nothing.
 */
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

const mountCheckout = async () => {
    const wrapper = mount(Checkout, {
        global: {
            stubs: Object.fromEntries(STUBBED_CHILDREN.map((name) => [name, true])),
        },
    });
    await flushPromises();

    return wrapper;
};

const editor = (wrapper: Awaited<ReturnType<typeof mountCheckout>>) =>
    wrapper.findComponent({ name: 'PlanCustomizationEditor' });

const completed = (wrapper: Awaited<ReturnType<typeof mountCheckout>>) =>
    wrapper.findComponent({ name: 'SubscriptionPaymentCompletedCard' });

// ─── Specs ────────────────────────────────────────────────────────────────────

describe('Checkout', () => {
    beforeEach(() => {
        isPaid.value = false;
        subscription.value = CUSTOMISABLE_SUBSCRIPTION;
        invoicePreview.value = {
            id: 'inv_preview',
            periods: [],
            tax_summary: { total_amount: { currency: 'EUR', quantity: '10.00' } },
        };
    });

    it('offers the plan customization while there is still something to pay for', async () => {
        const wrapper = await mountCheckout();

        expect(editor(wrapper).exists()).toBe(true);
        expect(completed(wrapper).exists()).toBe(false);
    });

    // A customer who has paid cannot change what they bought, so offering the choice is misleading.
    it('drops the plan customization once the payment has gone through', async () => {
        isPaid.value = true;

        const wrapper = await mountCheckout();

        expect(editor(wrapper).exists()).toBe(false);
        expect(completed(wrapper).exists()).toBe(true);
    });
});
