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
vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({ authorizePayment: mockAuthorizePayment }),
}));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({ tokenizePaymentMethod: mockTokenizePaymentMethod }),
}));

vi.mock('@/utils/adyen', () => ({
    createReturnUrl: vi.fn(() => 'https://example.com/return?payment_acceptor_id=paya_123'),
    PAYMENT_ACCEPTOR_ID_QUERY_STRING: 'payment_acceptor_id',
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
                    methods: { triggerSubmit: vi.fn() },
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
                        payment_intent_client_secret: 'pi_secret_redirect',
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

            expect(mockRetrievePaymentIntent).toHaveBeenCalledWith('pi_secret_redirect');
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
                        setup_intent_client_secret: 'seti_secret',
                    })[key] ?? null,
            );
            mockRetrieveSetupIntent.mockResolvedValue({ setupIntent: { status: 'succeeded' } });

            const wrapper = mountComponent({ variant: 'TOKENIZE' });
            await settle();

            expect(mockRetrieveSetupIntent).toHaveBeenCalledWith('seti_secret');
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

    describe('submitting', () => {
        const findFrame = (wrapper: ReturnType<typeof mountComponent>) =>
            wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' });

        it('reports the submit as invalid when the screen rejects it', async () => {
            const wrapper = mountComponent({ validateOnSubmit: () => Promise.resolve(false) });

            (wrapper.vm as unknown as { submit: () => void }).submit();
            await flushPromises();

            expect(wrapper.emitted('invalid')).toHaveLength(1);
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
