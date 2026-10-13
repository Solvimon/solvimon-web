import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PaymentIntegrationFormStripe from './PaymentIntegrationFormStripe.vue';
import type { PaymentIntegrationFormStripeProps } from './PaymentIntegrationFormStripe.types';
import { ApiError } from '@/services/apiError';

const mockAuthorizePayment = vi.fn();
const mockTokenizePaymentMethod = vi.fn();
const mockHandleNextAction = vi.fn();
const mockRetrievePaymentIntent = vi.fn();
const mockRetrieveSetupIntent = vi.fn();
const mockTriggerSubmit = vi.fn();
const mockLogger = vi.hoisted(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    capture: vi.fn(),
}));
vi.mock('@/components/providers', () => ({ useLogger: () => mockLogger }));

vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({ authorizePayment: mockAuthorizePayment }),
}));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({ tokenizePaymentMethod: mockTokenizePaymentMethod }),
}));

vi.mock('@/utils/adyen', () => ({
    createReturnUrl: vi.fn(() => 'https://example.com/return?payment_acceptor_id=paya_123'),
}));

vi.mock('@/utils/amount', () => ({
    toMinorUnitAmount: vi.fn(() => ({ value: 999, currency: 'EUR' })),
}));

const mockGetQueryParam = vi.fn();
vi.mock('@/utils/url', () => ({
    getQueryParam: (key: string) => mockGetQueryParam(key),
}));

const mockProps: PaymentIntegrationFormStripeProps = {
    countryCode: 'NL',
    customerId: 'cus_123',
    paymentMethodOptionResponseEntry: {
        payment_acceptor: {
            object_type: 'PAYMENT_ACCEPTOR',
            id: 'paya_123',
            name: 'Test Acceptor',
            reference: 'ref',
            status: 'ACTIVE',
        },
        integration: {
            id: 'int_123',
            object_type: 'INTEGRATION',
            reference: 'int-ref',
            name: 'Stripe Integration',
            description: '',
            status: 'ACTIVE',
            type: 'PAYMENT_GATEWAY',
            payment_gateway: {
                variant: 'STRIPE',
                stripe: { public_key: 'pk_test_123' },
            },
        },
        options: [],
    },
    variant: 'AUTHORIZE',
    selected: true,
    amount: { currency: 'EUR', quantity: '9.99' },
    context: {
        type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
        init_pricing_plan_subscription: {
            template_pricing_plan_subscription_id: 'ppsu_abc',
            customer_details: { email: 'test@example.com', type: 'INDIVIDUAL' },
        },
    },
};

const stripeActionRequiredResponse = {
    status: 'ACTION_REQUIRED' as const,
    action: {
        payment_gateway_variant: 'STRIPE' as const,
        url: '',
        method: 'POST',
        data: { client_secret: 'pi_secret_abc' },
    },
};

const stripeActionRequiredResponseTopLevel = {
    status: 'ACTION_REQUIRED' as const,
    action: {
        payment_gateway_variant: 'STRIPE' as const,
        client_secret: 'pi_secret_top',
        url: '',
        method: 'POST',
        data: {},
    },
};

const successResponse = {
    status: 'SUCCESS' as const,
    action: { payment_gateway_variant: 'STRIPE' as const, url: '', method: 'POST', data: {} },
};

function mountComponent(props: Partial<PaymentIntegrationFormStripeProps> = {}) {
    return mount(PaymentIntegrationFormStripe, {
        props: { ...mockProps, ...props },
        global: {
            stubs: {
                PaymentIntegrationFormStripeFrame: {
                    name: 'PaymentIntegrationFormStripeFrame',
                    template: '<div />',
                    emits: ['ready', 'change', 'loaderror', 'submit-success', 'submit-error'],
                    expose: ['triggerSubmit'],
                    methods: { triggerSubmit: mockTriggerSubmit },
                },
            },
        },
    });
}

describe('PaymentIntegrationFormStripe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetQueryParam.mockReturnValue(null);
        window.Stripe = vi.fn().mockReturnValue({
            handleNextAction: mockHandleNextAction,
            retrievePaymentIntent: mockRetrievePaymentIntent,
            retrieveSetupIntent: mockRetrieveSetupIntent,
        });
        mockHandleNextAction.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
        mockTriggerSubmit.mockReturnValue(true);
    });

    afterEach(() => {
        delete window.Stripe;
    });

    describe('handlePaymentResult — ACTION_REQUIRED', () => {
        it('reads client_secret from action.data when not at top level', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            const wrapper = mountComponent();

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(mockHandleNextAction).toHaveBeenCalledWith({ clientSecret: 'pi_secret_abc' });
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });

        it('reads client_secret from action.client_secret when present at top level', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponseTopLevel);
            const wrapper = mountComponent();

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(mockHandleNextAction).toHaveBeenCalledWith({ clientSecret: 'pi_secret_top' });
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('emits payment-failed when client_secret is missing from both locations', async () => {
            mockAuthorizePayment.mockResolvedValue({
                status: 'ACTION_REQUIRED',
                action: { payment_gateway_variant: 'STRIPE', url: '', method: 'POST', data: {} },
            });
            const wrapper = mountComponent();

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(mockHandleNextAction).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
        });

        it('emits payment-failed when handleNextAction returns an error', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            mockHandleNextAction.mockResolvedValue({ error: { message: 'Card declined' } });
            const wrapper = mountComponent();

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
            expect(wrapper.emitted('payment-success')).toBeUndefined();
        });
    });

    // A StripeError carries the intent it is about, and the intent carries its client secret.
    describe('Stripe errors that carry a client secret', () => {
        const LEAKY_ERROR = {
            type: 'card_error',
            code: 'payment_intent_authentication_failure',
            message: 'We are unable to authenticate your payment method.',
            payment_intent: { id: 'pi_1', client_secret: 'pi_1_secret_LEAK' },
        };

        /** Everything that leaves the form: what is logged, and what the host is told. */
        const reported = (wrapper: ReturnType<typeof mountComponent>) =>
            JSON.stringify([
                mockLogger.error.mock.calls,
                mockLogger.warn.mock.calls,
                wrapper.emitted('payment-failed'),
            ]);

        it('reports a failed next action without it', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            mockHandleNextAction.mockResolvedValue({ error: LEAKY_ERROR });
            const wrapper = mountComponent();

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await flushPromises();

            expect(mockLogger.error).toHaveBeenCalled();
            expect(reported(wrapper)).toContain('payment_intent_authentication_failure');
            expect(reported(wrapper)).not.toContain('pi_1_secret_LEAK');
        });

        it('reports a redirect return Stripe could not look up without it', async () => {
            mockGetQueryParam.mockImplementation(
                (key: string) =>
                    ({
                        payment_acceptor_id: 'paya_123',
                        redirect_status: 'succeeded',
                        payment_intent_client_secret: 'pi_3Redirect_secret_Abc123',
                    })[key] ?? null,
            );
            mockRetrievePaymentIntent.mockResolvedValue({ error: LEAKY_ERROR });
            const wrapper = mountComponent();

            await flushPromises();

            expect(mockLogger.error).toHaveBeenCalled();
            expect(reported(wrapper)).not.toContain('pi_1_secret_LEAK');
        });

        it('reports a next action that rejects without it, as unconfirmed', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            mockHandleNextAction.mockRejectedValue(LEAKY_ERROR);
            const wrapper = mountComponent();

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await flushPromises();

            expect(mockLogger.error).toHaveBeenCalled();
            expect(reported(wrapper)).toContain('payment_intent_authentication_failure');
            expect(reported(wrapper)).not.toContain('pi_1_secret_LEAK');
            expect(wrapper.emitted('payment-failed')?.[0]?.[0]).toMatchObject({
                code: 'PAYMENT_OUTCOME_UNCONFIRMED',
            });
        });

        it('reports a redirect lookup that rejects without it', async () => {
            mockGetQueryParam.mockImplementation(
                (key: string) =>
                    ({
                        payment_acceptor_id: 'paya_123',
                        redirect_status: 'succeeded',
                        payment_intent_client_secret: 'pi_3Redirect_secret_Abc123',
                    })[key] ?? null,
            );
            mockRetrievePaymentIntent.mockRejectedValue(LEAKY_ERROR);
            const wrapper = mountComponent();

            await flushPromises();

            expect(mockLogger.error).toHaveBeenCalled();
            expect(reported(wrapper)).not.toContain('pi_1_secret_LEAK');
        });
    });

    describe('handlePaymentResult — SUCCESS', () => {
        it('emits payment-success on a SUCCESS response', async () => {
            mockAuthorizePayment.mockResolvedValue(successResponse);
            const wrapper = mountComponent();

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(mockHandleNextAction).not.toHaveBeenCalled();
        });
    });

    describe('handleRedirectReturn', () => {
        const returnedWith = (redirectStatus: string, extra: Record<string, string> = {}) =>
            mockGetQueryParam.mockImplementation(
                (key: string) =>
                    ({
                        payment_acceptor_id: 'paya_123',
                        redirect_status: redirectStatus,
                        payment_intent_client_secret: 'pi_3Redirect_secret_Abc123',
                        ...extra,
                    })[key] ?? null,
            );

        const settle = async () => {
            await flushPromises();
            await nextTick();
        };

        const failedCode = (wrapper: ReturnType<typeof mountComponent>) =>
            (wrapper.emitted('payment-failed')?.[0]?.[0] as { code: string } | undefined)?.code;

        it('emits payment-success once Stripe confirms the payment succeeded', async () => {
            returnedWith('succeeded');
            mockRetrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });

            const wrapper = mountComponent();
            await settle();

            expect(mockRetrievePaymentIntent).toHaveBeenCalledWith('pi_3Redirect_secret_Abc123');
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        // Anyone can type `redirect_status=succeeded` into the address bar.
        it('does not take the query string at its word', async () => {
            returnedWith('succeeded');
            mockRetrievePaymentIntent.mockResolvedValue({
                paymentIntent: { status: 'requires_payment_method' },
            });

            const wrapper = mountComponent();
            await settle();

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCode(wrapper)).toBe('AUTHORIZATION_FAILED');
        });

        it('confirms a setup intent the same way', async () => {
            mockGetQueryParam.mockImplementation(
                (key: string) =>
                    ({
                        payment_acceptor_id: 'paya_123',
                        redirect_status: 'succeeded',
                        setup_intent_client_secret: 'seti_1Setup_secret_Def456',
                    })[key] ?? null,
            );
            mockRetrieveSetupIntent.mockResolvedValue({ setupIntent: { status: 'succeeded' } });

            const wrapper = mountComponent({ variant: 'TOKENIZE' });
            await settle();

            expect(mockRetrieveSetupIntent).toHaveBeenCalledWith('seti_1Setup_secret_Def456');
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        // SEPA and other bank debits come back `processing`; calling that a failure invited a
        // second payment.
        it('leaves a processing payment unconfirmed rather than failed', async () => {
            returnedWith('processing');
            mockRetrievePaymentIntent.mockResolvedValue({
                paymentIntent: { status: 'processing' },
            });

            const wrapper = mountComponent();
            await settle();

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCode(wrapper)).toBe('PAYMENT_OUTCOME_UNCONFIRMED');
        });

        it('leaves the payment unconfirmed when Stripe cannot be asked', async () => {
            returnedWith('succeeded');
            mockRetrievePaymentIntent.mockResolvedValue({ error: { message: 'network' } });

            const wrapper = mountComponent();
            await settle();

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCode(wrapper)).toBe('PAYMENT_OUTCOME_UNCONFIRMED');
        });

        it('emits payment-failed when Stripe says the payment failed', async () => {
            returnedWith('failed');
            mockRetrievePaymentIntent.mockResolvedValue({
                paymentIntent: { status: 'requires_payment_method' },
            });

            const wrapper = mountComponent();
            await settle();

            expect(failedCode(wrapper)).toBe('AUTHORIZATION_FAILED');
            expect(wrapper.emitted('payment-success')).toBeUndefined();
        });

        it('keeps the form away while the returned payment is being confirmed', async () => {
            returnedWith('succeeded');
            let answer: (value: unknown) => void = () => {};
            mockRetrievePaymentIntent.mockReturnValue(new Promise((r) => (answer = r)));

            const wrapper = mountComponent();
            await settle();

            expect(
                wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).exists(),
            ).toBe(false);

            answer({ paymentIntent: { status: 'requires_payment_method' } });
            await settle();

            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
        });

        it('ignores redirect params when acceptor id does not match', async () => {
            returnedWith('succeeded', { payment_acceptor_id: 'paya_OTHER' });

            const wrapper = mountComponent();
            await settle();

            expect(mockRetrievePaymentIntent).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
            expect(
                wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).exists(),
            ).toBe(true);
        });

        describe('the redirect return in the address', () => {
            const visit = (search: string) =>
                window.history.replaceState(null, '', `/pay${search}`);

            beforeEach(() =>
                visit(
                    '?coupon_code=SAVE&payment_acceptor_id=paya_123&redirect_status=failed&payment_intent=pi_3Redirect&payment_intent_client_secret=pi_3Redirect_secret_Abc123',
                ),
            );
            afterEach(() => visit(''));

            // Left in, a reload showed the same failure again and the customer could never retry.
            it('is taken out once Stripe has answered for it', async () => {
                returnedWith('failed');
                mockRetrievePaymentIntent.mockResolvedValue({
                    paymentIntent: { status: 'requires_payment_method' },
                });

                mountComponent();
                await settle();

                expect(window.location.search).toBe('?coupon_code=SAVE');
            });

            it('stays while Stripe could not be asked, so a reload asks again', async () => {
                returnedWith('succeeded');
                mockRetrievePaymentIntent.mockResolvedValue({ error: { message: 'network' } });

                mountComponent();
                await settle();

                expect(window.location.search).toContain('payment_intent_client_secret=');
            });
        });

        it('ignores a client secret Stripe could not have issued', async () => {
            returnedWith('succeeded', { payment_intent_client_secret: 'pi_1/../x' });

            const wrapper = mountComponent();
            await settle();

            expect(mockRetrievePaymentIntent).not.toHaveBeenCalled();
            expect(
                wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).exists(),
            ).toBe(true);
        });

        it('offers a fresh form when the customer tries again after a failed return', async () => {
            returnedWith('failed');
            mockRetrievePaymentIntent.mockResolvedValue({
                paymentIntent: { status: 'requires_payment_method' },
            });

            const wrapper = mountComponent();
            await settle();
            wrapper.findComponent({ name: 'PaymentErrorCard' }).vm.$emit('retry');
            await settle();

            expect(wrapper.findComponent({ name: 'PaymentErrorCard' }).exists()).toBe(false);
            expect(
                wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).exists(),
            ).toBe(true);
            expect(mockRetrievePaymentIntent).toHaveBeenCalledTimes(1);
        });

        it('does nothing when redirect_status is absent', async () => {
            mockGetQueryParam.mockReturnValue(null);

            const wrapper = mountComponent();
            await nextTick();

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });
    });

    describe('outcomes that are not known yet', () => {
        const submitToken = async (wrapper: ReturnType<typeof mountComponent>) => {
            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await flushPromises();
        };

        const failedCode = (wrapper: ReturnType<typeof mountComponent>) =>
            (wrapper.emitted('payment-failed')?.[0]?.[0] as { code: string } | undefined)?.code;

        // The form around it holds every other form off from here until this payment is over.
        it('says a payment is on its way before it asks for one', async () => {
            let emittedFirst = false;
            const wrapper = mountComponent();
            mockAuthorizePayment.mockImplementation(async () => {
                emittedFirst = wrapper.emitted('submitting')?.length === 1;
                return successResponse;
            });

            await submitToken(wrapper);

            expect(emittedFirst).toBe(true);
            expect(wrapper.emitted('submitting')).toHaveLength(1);
        });

        it('does not offer a retry when authorize never answered', async () => {
            mockAuthorizePayment.mockRejectedValue(new TypeError('Failed to fetch'));
            const wrapper = mountComponent();

            await submitToken(wrapper);

            expect(failedCode(wrapper)).toBe('PAYMENT_OUTCOME_UNCONFIRMED');
        });

        it('does not offer a retry after a server error', async () => {
            mockAuthorizePayment.mockRejectedValue(new ApiError({ statusCode: 502 }));
            const wrapper = mountComponent();

            await submitToken(wrapper);

            expect(failedCode(wrapper)).toBe('PAYMENT_OUTCOME_UNCONFIRMED');
        });

        it('still fails a payment the API turned down', async () => {
            mockAuthorizePayment.mockRejectedValue(new ApiError({ statusCode: 422 }));
            const wrapper = mountComponent();

            await submitToken(wrapper);

            expect(failedCode(wrapper)).toBe('AUTHORIZATION_FAILED');
        });

        it('leaves a pending payment unconfirmed', async () => {
            mockAuthorizePayment.mockResolvedValue({
                ...successResponse,
                payment: { result: 'PENDING' },
            });
            const wrapper = mountComponent();

            await submitToken(wrapper);

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCode(wrapper)).toBe('PAYMENT_OUTCOME_UNCONFIRMED');
        });

        it('leaves a payment still processing after the next action unconfirmed', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            mockHandleNextAction.mockResolvedValue({ paymentIntent: { status: 'processing' } });
            const wrapper = mountComponent();

            await submitToken(wrapper);

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCode(wrapper)).toBe('PAYMENT_OUTCOME_UNCONFIRMED');
        });
    });

    describe('confirming a redirect return', () => {
        const returnedWith = (redirectStatus: string) =>
            mockGetQueryParam.mockImplementation(
                (key: string) =>
                    ({
                        payment_acceptor_id: 'paya_123',
                        redirect_status: redirectStatus,
                        payment_intent_client_secret: 'pi_3Redirect_secret_Abc123',
                    })[key] ?? null,
            );

        const settle = async () => {
            await flushPromises();
            await nextTick();
        };

        const failedCodes = (wrapper: ReturnType<typeof mountComponent>) =>
            (wrapper.emitted('payment-failed') ?? []).map(([e]) => (e as { code: string }).code);

        it.each([
            ['requires_capture', 'success'],
            ['succeeded', 'success'],
            ['processing', 'PAYMENT_OUTCOME_UNCONFIRMED'],
            ['requires_action', 'AUTHORIZATION_FAILED'],
            ['requires_payment_method', 'AUTHORIZATION_FAILED'],
            ['requires_confirmation', 'AUTHORIZATION_FAILED'],
            ['canceled', 'AUTHORIZATION_FAILED'],
        ])('maps an intent that is %s to %s', async (intentStatus, expected) => {
            returnedWith('succeeded');
            mockRetrievePaymentIntent.mockResolvedValue({
                paymentIntent: { status: intentStatus },
            });

            const wrapper = mountComponent();
            await settle();

            if (expected === 'success') {
                expect(wrapper.emitted('payment-success')).toHaveLength(1);
                expect(wrapper.emitted('payment-failed')).toBeUndefined();
            } else {
                expect(wrapper.emitted('payment-success')).toBeUndefined();
                expect(failedCodes(wrapper)).toEqual([expected]);
            }
        });

        it('never reports success on a crafted query string when Stripe.js throws', async () => {
            returnedWith('succeeded');
            mockRetrievePaymentIntent.mockRejectedValue(new Error('Stripe.js blew up'));

            const wrapper = mountComponent();
            await settle();

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCodes(wrapper)).toEqual(['PAYMENT_OUTCOME_UNCONFIRMED']);
            expect(wrapper.text()).toContain('Payment not confirmed yet');
        });

        it('never reports success when Stripe.js cannot be loaded at all', async () => {
            returnedWith('succeeded');
            delete window.Stripe;

            const wrapper = mountComponent();
            const script = document.head.querySelector<HTMLScriptElement>('script[src]');
            script?.onerror?.(new Event('error'));
            await settle();

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCodes(wrapper)).toEqual(['PAYMENT_OUTCOME_UNCONFIRMED']);
        });

        it('does not authorize when submitted while the return is being confirmed', async () => {
            returnedWith('succeeded');
            let answer: (value: unknown) => void = () => {};
            mockRetrievePaymentIntent.mockReturnValue(new Promise((r) => (answer = r)));

            const wrapper = mountComponent();
            await settle();

            (wrapper.vm as unknown as { submit: () => void }).submit();
            await settle();

            expect(wrapper.emitted('invalid')).toHaveLength(1);
            expect(mockAuthorizePayment).not.toHaveBeenCalled();

            answer({ paymentIntent: { status: 'succeeded' } });
            await settle();

            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(
                wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).exists(),
            ).toBe(false);
        });

        it('emits success exactly once and does not offer the form again', async () => {
            returnedWith('succeeded');
            mockRetrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });

            const wrapper = mountComponent();
            await settle();
            await wrapper.setProps({ amount: { currency: 'EUR', quantity: '19.99' } });
            await settle();

            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(mockRetrievePaymentIntent).toHaveBeenCalledTimes(1);
            expect(
                wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).exists(),
            ).toBe(false);
        });

        it('keeps an unconfirmed outcome on screen instead of the form', async () => {
            returnedWith('processing');
            mockRetrievePaymentIntent.mockResolvedValue({
                paymentIntent: { status: 'processing' },
            });

            const wrapper = mountComponent();
            await settle();
            await wrapper.setProps({ amount: { currency: 'EUR', quantity: '19.99' } });
            await settle();

            expect(wrapper.text()).toContain('Payment not confirmed yet');
            expect(
                wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).exists(),
            ).toBe(false);
        });
    });

    describe('authorize outcomes', () => {
        const submitToken = async (wrapper: ReturnType<typeof mountComponent>) => {
            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await flushPromises();
        };
        const failedCodes = (wrapper: ReturnType<typeof mountComponent>) =>
            (wrapper.emitted('payment-failed') ?? []).map(([e]) => (e as { code: string }).code);

        it.each([400, 401, 402, 403, 404, 409, 422])(
            'reports a %i as a failure',
            async (statusCode) => {
                mockAuthorizePayment.mockRejectedValue(new ApiError({ statusCode }));
                const wrapper = mountComponent();
                await submitToken(wrapper);
                expect(failedCodes(wrapper)).toEqual(['AUTHORIZATION_FAILED']);
            },
        );

        it.each([408, 500, 503, 504])('leaves a %i unconfirmed', async (statusCode) => {
            mockAuthorizePayment.mockRejectedValue(new ApiError({ statusCode }));
            const wrapper = mountComponent();
            await submitToken(wrapper);
            expect(failedCodes(wrapper)).toEqual(['PAYMENT_OUTCOME_UNCONFIRMED']);
            expect(wrapper.text()).not.toMatch(/try again/i);
        });

        it('leaves a payment unconfirmed when the next action reports no intent', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            mockHandleNextAction.mockResolvedValue({});
            const wrapper = mountComponent();
            await submitToken(wrapper);
            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCodes(wrapper)).toEqual(['PAYMENT_OUTCOME_UNCONFIRMED']);
        });

        it('fails a payment the next action left needing a new method', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            mockHandleNextAction.mockResolvedValue({
                paymentIntent: { status: 'requires_payment_method' },
            });
            const wrapper = mountComponent();
            await submitToken(wrapper);
            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCodes(wrapper)).toEqual(['AUTHORIZATION_FAILED']);
        });

        it('succeeds once for a setup intent the next action completed', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            mockHandleNextAction.mockResolvedValue({ setupIntent: { status: 'succeeded' } });
            const wrapper = mountComponent();
            await submitToken(wrapper);
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('fails an authorize answered SUCCESS with a refused payment', async () => {
            mockAuthorizePayment.mockResolvedValue({
                ...successResponse,
                payment: { result: 'REFUSED' },
            });
            const wrapper = mountComponent();
            await submitToken(wrapper);
            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(failedCodes(wrapper)).toEqual(['AUTHORIZATION_FAILED']);
        });
    });

    describe('submitting', () => {
        const findFrame = (wrapper: ReturnType<typeof mountComponent>) =>
            wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' });

        it('reports the submit as invalid when the screen rejects it', async () => {
            const wrapper = mountComponent({ validateOnSubmit: () => Promise.resolve(false) });

            (wrapper.vm as unknown as { submit: () => void }).submit();
            await flushPromises();

            expect(wrapper.emitted('invalid')).toHaveLength(1);
        });

        it('hands a valid submit to the frame and waits for its answer', async () => {
            const wrapper = mountComponent();

            (wrapper.vm as unknown as { submit: () => void }).submit();
            await flushPromises();

            expect(mockTriggerSubmit).toHaveBeenCalledTimes(1);
            expect(wrapper.emitted('invalid')).toBeUndefined();
        });

        it('reports the submit as invalid when the frame could not send it', async () => {
            mockTriggerSubmit.mockReturnValue(false);
            const wrapper = mountComponent();

            (wrapper.vm as unknown as { submit: () => void }).submit();
            await flushPromises();

            expect(wrapper.emitted('invalid')).toHaveLength(1);
        });

        it('reports the submit as invalid when the screen fails to validate', async () => {
            const wrapper = mountComponent({
                validateOnSubmit: () => Promise.reject(new Error('validation threw')),
            });

            (wrapper.vm as unknown as { submit: () => void }).submit();
            await flushPromises();

            expect(wrapper.emitted('invalid')).toHaveLength(1);
            expect(mockTriggerSubmit).not.toHaveBeenCalled();
        });

        it('reports the submit as invalid when Stripe finds the fields incomplete', async () => {
            const wrapper = mountComponent();

            await findFrame(wrapper).vm.$emit('submit-error', {
                type: 'validation_error',
                message: 'Your card number is incomplete.',
            });

            expect(wrapper.emitted('invalid')).toHaveLength(1);
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });

        it('fails the payment on any other Stripe submit error', async () => {
            const wrapper = mountComponent();

            await findFrame(wrapper).vm.$emit('submit-error', {
                type: 'api_error',
                message: 'Something went wrong.',
            });

            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
            expect(wrapper.emitted('invalid')).toBeUndefined();
        });
    });

    describe('TOKENIZE variant', () => {
        it('calls tokenizePaymentMethod and emits payment-success on SUCCESS', async () => {
            mockTokenizePaymentMethod.mockResolvedValue(successResponse);
            const wrapper = mountComponent({ variant: 'TOKENIZE' });

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(mockTokenizePaymentMethod).toHaveBeenCalled();
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('emits payment-failed when tokenizePaymentMethod throws', async () => {
            mockTokenizePaymentMethod.mockRejectedValue(new Error('network error'));
            const wrapper = mountComponent({ variant: 'TOKENIZE' });

            await wrapper
                .findComponent({ name: 'PaymentIntegrationFormStripeFrame' })
                .vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
        });
    });
});
