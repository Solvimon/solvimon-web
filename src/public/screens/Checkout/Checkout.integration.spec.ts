import { flushPromises, mount } from '@vue/test-utils';
import { computed, ref } from 'vue';
import type { PortalUrl } from '@solvimon/solvimon-types';
import Checkout from './Checkout.vue';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
    isPaid,
    subscription,
    invoicePreview,
    recurringAmount,
    hasOneOffCharges,
    hasPaymentMethodOptionsError,
    isInvoicePreviewPending,
    isInvoicePreviewStale,
    settleInvoicePreview,
    checkoutFormValue,
    amountValue,
    SEATS_VALUES,
} = vi.hoisted(() => ({
    /** The amount the screen was last handed, to change it from a spec. */
    amountValue: {
        current: undefined as { value: { currency: string; quantity: string } } | undefined,
    },
    isPaid: { value: false },
    isInvoicePreviewPending: { value: false },
    isInvoicePreviewStale: { value: false },
    settleInvoicePreview: vi.fn(() => Promise.resolve('SETTLED')),
    /** The form the screen was last handed, to change it from a spec. */
    checkoutFormValue: { current: undefined as { value: Record<string, unknown> } | undefined },
    hasPaymentMethodOptionsError: { value: false },
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
            hasPaymentMethodOptionsError: c(() => hasPaymentMethodOptionsError.value),
            subscription: c(() => subscription.value),
            isPaymentMethodsPending: r(false),
            isInvoicePreviewPending: c(() => isInvoicePreviewPending.value),
            isInvoicePreviewStale: c(() => isInvoicePreviewStale.value),
            settleInvoicePreview,
            checkoutForm: {
                form: (checkoutFormValue.current = r<Record<string, unknown>>({
                    country: 'NL',
                    enabledPricingIds: [],
                    seatsValues: SEATS_VALUES,
                })),
                initialState: r({ seatsValues: SEATS_VALUES }),
                validation: r({ $validate: vi.fn(), $invalid: false }),
                getIsFieldRequired: () => false,
                shippingAddressFormat: r(undefined),
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
            amount: (amountValue.current = r({ currency: 'EUR', quantity: '10.00' })),
            recurringAmount: c(() => recurringAmount.value),
            hasOneOffCharges: c(() => hasOneOffCharges.value),
            loadInvoicePreview: vi.fn(),
            updateInvoicePreviewOnBillingInformationChange: vi.fn(),
            saveFormStateForRedirect,
            clearSavedFormState,
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

const {
    mockExperimentalFeatures,
    updateInitialState,
    saveFormStateForRedirect,
    clearSavedFormState,
} = vi.hoisted(() => ({
    saveFormStateForRedirect: vi.fn(),
    clearSavedFormState: vi.fn(),
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
        isInvoicePreviewPending.value = false;
        isInvoicePreviewStale.value = false;
        settleInvoicePreview.mockReset();
        settleInvoicePreview.mockResolvedValue('SETTLED');
        hasPaymentMethodOptionsError.value = false;
        paymentMethodOptions.value = [];
        portalNote.note = undefined;
        subscription.value = CUSTOMISABLE_SUBSCRIPTION;
        // A preview without a period leaves the express agreement no start date to state.
        invoicePreview.value = {
            id: 'inv_preview',
            periods: [{ start_at: '2026-10-09T00:00:00.000Z' }],
            tax_summary: { total_amount: { currency: 'EUR', quantity: '10.00' } },
        };
        recurringAmount.value = { currency: 'EUR', quantity: '10.00' };
        hasOneOffCharges.value = false;
    });

    describe('what the invoice charges once, and what it charges again', () => {
        beforeEach(() => {
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

        it('leaves the title a single amount when nothing is charged only once', async () => {
            const wrapper = await mountCheckout({ Skeleton: false });

            expect(title(wrapper).props('recurringAmount')).toBeUndefined();
        });

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

    // The payment may still go through; a second press of the button could charge twice.
    it('keeps the pay button off once a payment outcome is unconfirmed', async () => {
        paymentMethodOptions.value = [{ integration: { payment_gateway: { variant: 'ADYEN' } } }];
        const wrapper = await mountCheckout({ Skeleton: false });
        const submit = () => wrapper.find('.sv-checkout__submit');

        expect(submit().attributes('disabled')).toBe('false');

        wrapper.findComponent({ name: 'PaymentIntegrationForm' }).vm.$emit('payment-failed', {
            code: 'PAYMENT_OUTCOME_UNCONFIRMED',
            message: 'Payment could not be confirmed',
        });
        await wrapper.vm.$nextTick();

        expect(submit().attributes('disabled')).toBe('true');
        expect(wrapper.find('.sv-checkout__payment-error').exists()).toBe(false);
    });

    // A failed reload keeps the options it had, but the form they fed is gone; nothing would
    // answer a submit, and the button would spin for good.
    it('keeps the pay button off while the payment methods failed to load', async () => {
        paymentMethodOptions.value = [{ integration: { payment_gateway: { variant: 'ADYEN' } } }];
        hasPaymentMethodOptionsError.value = true;
        const wrapper = await mountCheckout({ Skeleton: false });
        const submit = () => wrapper.find('.sv-checkout__submit');

        expect(wrapper.findComponent({ name: 'PaymentIntegrationForm' }).exists()).toBe(false);
        expect(submit().attributes('disabled')).toBe('true');

        const submitButton = wrapper
            .findAllComponents({ name: 'Button' })
            .find((button) => button.classes('sv-checkout__submit'));
        await submitButton?.vm.$emit('click');
        await flushPromises();

        expect(submit().attributes('loading')).toBe('false');
    });

    // Enter in a card field pays without the button; the screen must still hold the button and
    // keep the form for the redirect it may lead to.
    it('waits on a payment the form started on its own', async () => {
        paymentMethodOptions.value = [{ integration: { payment_gateway: { variant: 'ADYEN' } } }];
        const wrapper = await mountCheckout({ Skeleton: false });
        const submit = () => wrapper.find('.sv-checkout__submit');

        wrapper.findComponent({ name: 'PaymentIntegrationForm' }).vm.$emit('submitting');
        await wrapper.vm.$nextTick();

        expect(submit().attributes('loading')).toBe('true');
        expect(submit().attributes('disabled')).toBe('true');
        expect(saveFormStateForRedirect).toHaveBeenCalledTimes(1);
    });

    // Adyen draws a 3DS challenge inside the form; held, the customer could not click it.
    it('leaves the form within reach while the gateway waits on the customer', async () => {
        paymentMethodOptions.value = [{ integration: { payment_gateway: { variant: 'ADYEN' } } }];
        const wrapper = await mountCheckout({ Skeleton: false });
        const form = wrapper.findComponent({ name: 'PaymentIntegrationForm' });
        const isHeld = () =>
            wrapper.find('.sv-checkout__payment-form .pointer-events-none').exists();

        form.vm.$emit('submitting');
        await wrapper.vm.$nextTick();
        expect(isHeld()).toBe(true);

        form.vm.$emit('action-required');
        await wrapper.vm.$nextTick();

        expect(isHeld()).toBe(false);
        expect(wrapper.find('.sv-checkout__submit').attributes('disabled')).toBe('true');
    });

    // The amount authorized is the preview's; paying while it reloads would charge the old one.
    it('keeps the pay button off while the invoice preview reloads', async () => {
        paymentMethodOptions.value = [{ integration: { payment_gateway: { variant: 'ADYEN' } } }];
        isInvoicePreviewPending.value = true;
        const wrapper = await mountCheckout({ Skeleton: false });

        expect(wrapper.find('.sv-checkout__submit').attributes('disabled')).toBe('true');
    });

    // The preview is asked for 200ms after a change; paying in between would charge the old price.
    it('keeps the pay button off while a change waits to be priced', async () => {
        paymentMethodOptions.value = [{ integration: { payment_gateway: { variant: 'ADYEN' } } }];
        isInvoicePreviewStale.value = true;
        const wrapper = await mountCheckout({ Skeleton: false });

        expect(wrapper.find('.sv-checkout__submit').attributes('disabled')).toBe('true');
    });

    // Enter in a card field and an express sheet pay without the button, so the check that holds
    // a payment for the price sits where every one of them asks first.
    describe('before any payment is sent', () => {
        const validateOnSubmit = async () => {
            paymentMethodOptions.value = [
                { integration: { payment_gateway: { variant: 'ADYEN' } } },
            ];
            const wrapper = await mountCheckout({ Skeleton: false });
            const form = wrapper.findComponent({ name: 'PaymentIntegrationForm' });
            const validate = form.vm.$attrs['validate-on-submit'] as () => Promise<boolean>;
            return { wrapper, validate };
        };

        it('waits for the price of the form as it is', async () => {
            const { validate } = await validateOnSubmit();

            await expect(validate()).resolves.toBe(true);
            expect(settleInvoicePreview).toHaveBeenCalledTimes(1);
        });

        it('holds the payment back, and says so, when the price cannot be brought up to date', async () => {
            settleInvoicePreview.mockResolvedValue('FAILED');
            const { wrapper, validate } = await validateOnSubmit();

            await expect(validate()).resolves.toBe(false);
            await wrapper.vm.$nextTick();
            expect(wrapper.find('.sv-checkout__payment-error').exists()).toBe(true);
        });

        // Nothing failed: the customer changed the order, and needs to see its new price first.
        it('says the price changed when the customer changed the order while it waited', async () => {
            settleInvoicePreview.mockResolvedValue('CHANGED');
            const { wrapper, validate } = await validateOnSubmit();

            await expect(validate()).resolves.toBe(false);
            await wrapper.vm.$nextTick();
            expect(wrapper.find('.sv-checkout__payment-error').attributes('title')).toMatch(
                /price changed/i,
            );
        });

        // A card gateway reads the amount and the order only once it hands its token back.
        it('sends the amount and the order of the moment the price settled', async () => {
            const { wrapper, validate } = await validateOnSubmit();
            const form = () => wrapper.findComponent({ name: 'PaymentIntegrationForm' });

            await validate();
            amountValue.current!.value = { currency: 'EUR', quantity: '50.00' };
            await wrapper.vm.$nextTick();

            expect(form().vm.$attrs.amount).toEqual({ currency: 'EUR', quantity: '10.00' });

            form().vm.$emit('payment-failed', { message: 'Declined' });
            await wrapper.vm.$nextTick();

            expect(form().vm.$attrs.amount).toEqual({ currency: 'EUR', quantity: '50.00' });
        });

        it('locks the order while the payment is out, and frees it once it fails', async () => {
            const { wrapper, validate } = await validateOnSubmit();
            const locked = () =>
                ['CheckoutForm', 'PlanCustomizationEditor', 'PromotionCodeSection'].map(
                    (name) => wrapper.findComponent({ name }).attributes('inert') !== undefined,
                );

            expect(locked()).toEqual([false, false, false]);

            await validate();
            await wrapper.vm.$nextTick();
            expect(locked()).toEqual([true, true, true]);

            wrapper.findComponent({ name: 'PaymentIntegrationForm' }).vm.$emit('invalid');
            await wrapper.vm.$nextTick();
            expect(locked()).toEqual([false, false, false]);
        });
    });

    // The form is kept for a redirect; a payment that ends on this page leaves no personal data.
    it.each([
        ['fails', 'payment-failed', [{ message: 'Declined' }]],
        ['is not submitted', 'invalid', []],
        ['succeeds', 'payment-success', []],
    ])('clears the form kept for a redirect when a payment %s', async (_, event, args) => {
        paymentMethodOptions.value = [{ integration: { payment_gateway: { variant: 'ADYEN' } } }];
        const wrapper = await mountCheckout({ Skeleton: false });
        clearSavedFormState.mockClear();

        wrapper.findComponent({ name: 'PaymentIntegrationForm' }).vm.$emit(event, ...args);
        await wrapper.vm.$nextTick();

        expect(clearSavedFormState).toHaveBeenCalledTimes(1);
    });

    // A code restored with the form from a redirect is priced and sent, so it has to be on screen
    // where the customer can see and remove it.
    it('shows a promotion code the form was given', async () => {
        const wrapper = await mountCheckout();

        checkoutFormValue.current!.value.promotionCode = 'SPRING';
        await wrapper.vm.$nextTick();

        expect(
            wrapper.findComponent({ name: 'PromotionCodeSection' }).attributes('promotioncode'),
        ).toBe('SPRING');
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
        // only offered where the merchant has opted into express checkout.
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

        // The sheet closes with nothing on screen, and "try again" is the double charge.
        it('says not to pay again when an express payment is unconfirmed', async () => {
            mockExperimentalFeatures.value = { 'express-checkout': true };

            const wrapper = await mountCheckout();

            wrapper.findComponent({ name: 'ExpressPaymentMethods' }).vm.$emit(
                'payment-failed',
                Object.assign(new Error('Apple Pay payment could not be confirmed'), {
                    code: 'PAYMENT_OUTCOME_UNCONFIRMED',
                }),
            );
            await wrapper.vm.$nextTick();

            expect(wrapper.find('.sv-checkout__payment-error').attributes('title')).toContain(
                'do not pay again',
            );
        });
    });

    describe('after an unconfirmed payment', () => {
        afterEach(() => {
            mockExperimentalFeatures.value = { 'express-checkout': false };
        });

        const reportUnconfirmed = (wrapper: Awaited<ReturnType<typeof mountCheckout>>) =>
            wrapper.findComponent({ name: 'PaymentIntegrationForm' }).vm.$emit('payment-failed', {
                code: 'PAYMENT_OUTCOME_UNCONFIRMED',
                message: 'Payment could not be confirmed',
            });

        // The card form is out of reach, but an express sheet is a second way to pay.
        it('offers no express payment method while the first payment may still go through', async () => {
            mockExperimentalFeatures.value = { 'express-checkout': true };
            paymentMethodOptions.value = [
                { integration: { payment_gateway: { variant: 'ADYEN' } } },
            ];
            const wrapper = await mountCheckout({ Skeleton: false });
            expect(wrapper.findComponent({ name: 'ExpressPaymentMethods' }).exists()).toBe(true);

            reportUnconfirmed(wrapper);
            await flushPromises();

            expect(wrapper.findComponent({ name: 'ExpressPaymentMethods' }).exists()).toBe(false);
        });

        it('keeps the pay button off after a later failure is reported', async () => {
            paymentMethodOptions.value = [
                { integration: { payment_gateway: { variant: 'ADYEN' } } },
            ];
            const wrapper = await mountCheckout({ Skeleton: false });

            reportUnconfirmed(wrapper);
            await flushPromises();
            wrapper.findComponent({ name: 'PaymentIntegrationForm' }).vm.$emit('payment-failed', {
                code: 'AUTHORIZATION_FAILED',
                message: 'Payment failed',
            });
            await flushPromises();

            expect(wrapper.find('.sv-checkout__submit').attributes('disabled')).toBe('true');
        });
    });
});
