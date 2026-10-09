import { flushPromises, mount } from '@vue/test-utils';
import { computed, ref } from 'vue';
import type { PortalUrl } from '@/services/portals.types';
import Checkout from './Checkout.vue';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { isPaid, subscription, invoicePreview, recurringAmount, hasOneOffCharges, SEATS_VALUES } =
    vi.hoisted(() => ({
        isPaid: { value: false },
        subscription: { value: undefined as unknown },
        invoicePreview: { value: undefined as unknown },
        recurringAmount: { value: undefined as unknown },
        hasOneOffCharges: { value: false },
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
            paymentMethodOptions: c(() => paymentMethodOptions.value),
            subscription: c(() => subscription.value),
            isPaymentMethodsPending: r(false),
            isInvoicePreviewPending: r(false),
            checkoutForm: {
                form: r({ country: 'NL', enabledPricingIds: [], seatsValues: SEATS_VALUES }),
                initialState: r({ seatsValues: SEATS_VALUES }),
                validation: r({ $validate: vi.fn(), $invalid: false }),
                getIsFieldRequired: () => false,
                updateInitialState,
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
            recurringAmount: c(() => recurringAmount.value),
            hasOneOffCharges: c(() => hasOneOffCharges.value),
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

const { mockExperimentalFeatures, updateInitialState } = vi.hoisted(() => ({
    mockExperimentalFeatures: { value: { 'express-checkout': false } },
    updateInitialState: vi.fn(),
}));

vi.mock(
    '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature',
    () => ({ useExperimentalFeature: () => mockExperimentalFeatures }),
);

const PORTAL = {
    object_type: 'PORTAL_URL',
    id: 'purl_checkout',
    type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
    status: 'PUBLISHED',
    token: 'test-portal-token',
    init_pricing_plan_subscription: {
        pricing_plan_subscription_id: 'sub_1',
        success_url: undefined,
        note: undefined as string | undefined,
    },
} as unknown as PortalUrl;

const portalNote = (PORTAL as unknown as { init_pricing_plan_subscription: { note?: string } })
    .init_pricing_plan_subscription;

vi.mock('@/components/providers/PortalProvider/composables/usePortal', () => ({
    usePortal: () => ref(PORTAL),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const paymentMethodOptions = ref<unknown[]>([]);

const CUSTOMISABLE_SUBSCRIPTION = {
    id: 'sub_1',
    billing_period: 'MONTHLY',
    pricing_plan_schedule_infos: [],
    billing_entity: { legal_name: 'ACME B.V.' },
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

const mountCheckout = async (stubOverrides: Record<string, boolean> = {}) => {
    const wrapper = mount(Checkout, {
        global: {
            stubs: {
                ...Object.fromEntries(STUBBED_CHILDREN.map((name) => [name, true])),
                ...stubOverrides,
            },
        },
    });
    await flushPromises();
    // The screen's children are async components, and their dynamic imports outlive
    // `flushPromises`: left pending, they resolve after the environment is torn down.
    await vi.dynamicImportSettled();

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
        paymentMethodOptions.value = [];
        portalNote.note = undefined;
        subscription.value = CUSTOMISABLE_SUBSCRIPTION;
        invoicePreview.value = {
            id: 'inv_preview',
            periods: [],
            tax_summary: { total_amount: { currency: 'EUR', quantity: '10.00' } },
        };
        recurringAmount.value = { currency: 'EUR', quantity: '10.00' };
        hasOneOffCharges.value = false;
    });

    describe('what the invoice charges once, and what it charges again', () => {
        beforeEach(() => {
            // The title renders behind a start date, which is read off the preview's first period.
            invoicePreview.value = {
                id: 'inv_preview',
                periods: [{ start_at: '2026-10-09T00:00:00.000Z' }],
                invoice_amount_including_tax: { currency: 'EUR', quantity: '10.00' },
                tax_summary: { total_amount: { currency: 'EUR', quantity: '10.00' } },
            };
        });

        const title = (wrapper: Awaited<ReturnType<typeof mountCheckout>>) =>
            wrapper.findComponent({ name: 'CheckoutTitle' });

        const expressBillingInformation = (wrapper: Awaited<ReturnType<typeof mountCheckout>>) =>
            wrapper
                .findComponent({ name: 'ExpressPaymentMethods' })
                .props('billingInformation') as { regular?: { amount: { quantity: string } } };

        // Hardware and shipping are billed on the same invoice as the subscription. Telling the
        // customer that total is what they pay every month names a price nobody will charge.
        it('hands the title a recurring amount of its own once the invoice holds a one-off charge', async () => {
            hasOneOffCharges.value = true;
            recurringAmount.value = { currency: 'EUR', quantity: '8.00' };

            const wrapper = await mountCheckout({ Skeleton: false });

            expect(title(wrapper).props('recurringAmount')).toEqual({
                currency: 'EUR',
                quantity: '8.00',
            });
            expect(title(wrapper).props('dueTodayAmount')).toEqual({
                currency: 'EUR',
                quantity: '10.00',
            });
        });

        // An invoice that only subscribes reads as it always has: one amount, stated once.
        it('leaves the title a single amount when nothing is charged only once', async () => {
            const wrapper = await mountCheckout({ Skeleton: false });

            expect(title(wrapper).props('recurringAmount')).toBeUndefined();
        });

        // The sheet's recurring amount is the mandate the customer authorizes, so it has to be
        // what will actually be charged again — not the first invoice's total.
        it('mandates the recurring amount in an express sheet, not the amount due today', async () => {
            mockExperimentalFeatures.value = { 'express-checkout': true };
            hasOneOffCharges.value = true;
            recurringAmount.value = { currency: 'EUR', quantity: '8.00' };

            const wrapper = await mountCheckout();

            expect(expressBillingInformation(wrapper).regular?.amount).toEqual({
                currency: 'EUR',
                quantity: '8.00',
            });
        });

        // Hardware bought outright renews at nothing. A sheet carrying a recurring request would
        // sign the customer up for a subscription that does not exist.
        it('mandates nothing recurring in an express sheet when the order does not renew', async () => {
            mockExperimentalFeatures.value = { 'express-checkout': true };
            hasOneOffCharges.value = true;
            recurringAmount.value = { currency: 'EUR', quantity: '0.00' };

            const wrapper = await mountCheckout();

            expect(expressBillingInformation(wrapper).regular).toBeUndefined();
        });
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

    // The SEPA mandate names the party collecting the money, and only this screen knows it.
    // Asserted on the rendered attribute rather than props(): the form is stubbed, and a stub
    // declares no props of its own, so props() reads undefined for everything.
    it('hands the billing entity name to the payment form', async () => {
        paymentMethodOptions.value = [{ integration: { payment_gateway: { variant: 'ADYEN' } } }];

        // Skeleton is stubbed for every other case, and a stub renders no slots — the payment form
        // lives inside one, so it has to be real here or nothing below it mounts.
        const wrapper = await mountCheckout({ Skeleton: false });

        expect(
            wrapper.find('payment-integration-form-stub').attributes('billing-entity-name'),
        ).toBe('ACME B.V.');
    });

    describe('terms and conditions', () => {
        it('shows the merchant note in the footer, below both columns', async () => {
            portalNote.note = 'By subscribing you agree to the [terms](https://example.com).';

            const wrapper = await mountCheckout();

            // Asserted by position, not just presence: the whole point of the change is where it
            // sits, and `.sv-checkout__terms` exists either way.
            expect(wrapper.find('.sv-layout__footer .sv-checkout__terms').exists()).toBe(true);
            expect(wrapper.find('.sv-layout__aside .sv-checkout__terms').exists()).toBe(false);
        });

        it('shows nothing when the checkout page carries no note', async () => {
            const wrapper = await mountCheckout();

            expect(wrapper.find('.sv-checkout__terms').exists()).toBe(false);
            // No note means no footer region at all, rather than an empty band under the columns.
            expect(wrapper.find('.sv-layout__footer').exists()).toBe(false);
        });

        it('shows nothing for a note of only whitespace', async () => {
            portalNote.note = '   \n  ';

            const wrapper = await mountCheckout();

            expect(wrapper.find('.sv-checkout__terms').exists()).toBe(false);
        });

        // The note is only ever an agreement to pay, so it has no place once payment is done.
        it('drops the note once the payment has gone through', async () => {
            portalNote.note = 'By subscribing you agree.';
            isPaid.value = true;

            const wrapper = await mountCheckout();

            expect(wrapper.find('.sv-checkout__terms').exists()).toBe(false);
        });
    });

    describe('express payment methods', () => {
        beforeEach(() => {
            mockExperimentalFeatures.value = { 'express-checkout': false };
        });

        // The Apple Pay button could charge a customer with nothing happening on screen, so it is
        // only offered where the merchant has opted into express checkout (DD-3535).
        it('offers none while express checkout is off', async () => {
            const wrapper = await mountCheckout();

            expect(wrapper.findComponent({ name: 'ExpressPaymentMethods' }).exists()).toBe(false);
        });

        it('offers them once the merchant opts in', async () => {
            mockExperimentalFeatures.value = { 'express-checkout': true };

            const wrapper = await mountCheckout();

            expect(wrapper.findComponent({ name: 'ExpressPaymentMethods' }).exists()).toBe(true);
        });

        // An address speaks `postal_code` and `line1`; the form has `postalCode` and
        // `addressLine1`. Spreading one into the other dropped both on the floor.
        it('writes what an express sheet collected into the checkout form', async () => {
            mockExperimentalFeatures.value = { 'express-checkout': true };

            const wrapper = await mountCheckout();

            wrapper
                .findComponent({ name: 'ExpressPaymentMethods' })
                .vm.$emit('update-billing-information', {
                    line1: 'Main street 1',
                    line2: 'Second floor',
                    postal_code: '1000AA',
                    city: 'Amsterdam',
                    state: 'NH',
                    country: 'NL',
                    email: 'customer@example.com',
                });

            expect(updateInitialState).toHaveBeenCalledWith({
                addressLine1: 'Main street 1',
                addressLine2: 'Second floor',
                postalCode: '1000AA',
                city: 'Amsterdam',
                state: 'NH',
                country: 'NL',
                email: 'customer@example.com',
            });
        });

        it('says so when an express payment does not go through', async () => {
            mockExperimentalFeatures.value = { 'express-checkout': true };

            const wrapper = await mountCheckout();

            wrapper
                .findComponent({ name: 'ExpressPaymentMethods' })
                .vm.$emit('payment-failed', new Error('Apple Pay payment was not authorized'));
            await wrapper.vm.$nextTick();

            expect(wrapper.find('.sv-checkout__payment-error').exists()).toBe(true);
        });
    });
});
