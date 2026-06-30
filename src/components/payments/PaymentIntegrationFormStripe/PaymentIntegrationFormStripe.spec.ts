import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PaymentIntegrationFormStripe from './PaymentIntegrationFormStripe.vue';
import type { PaymentIntegrationFormStripeProps } from './PaymentIntegrationFormStripe.types';

const mockAuthorizePayment = vi.fn();
const mockTokenizePaymentMethod = vi.fn();
const mockHandleNextAction = vi.fn();
const mockLoadStripe = vi.fn();
vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({ authorizePayment: mockAuthorizePayment }),
}));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({ tokenizePaymentMethod: mockTokenizePaymentMethod }),
}));

vi.mock('@/utils/adyen', () => ({
    createReturnUrl: vi.fn(() => 'https://example.com/return?payment_acceptor_id=paya_123'),
    transformToAdyenAmount: vi.fn((amount) => ({ value: 999 })),
    PAYMENT_ACCEPTOR_ID_QUERY_STRING: 'payment_acceptor_id',
}));

const mockGetQueryParam = vi.fn();
vi.mock('@/utils/url', () => ({
    getQueryParam: (key: string) => mockGetQueryParam(key),
}));

vi.mock('@stripe/stripe-js', () => ({
    loadStripe: mockLoadStripe,
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
        mockLoadStripe.mockResolvedValue({ handleNextAction: mockHandleNextAction });
        mockHandleNextAction.mockResolvedValue({ error: null });
    });

    describe('handlePaymentResult — ACTION_REQUIRED', () => {
        it('reads client_secret from action.data when not at top level', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            const wrapper = mountComponent();

            await wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(mockHandleNextAction).toHaveBeenCalledWith({ clientSecret: 'pi_secret_abc' });
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });

        it('reads client_secret from action.client_secret when present at top level', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponseTopLevel);
            const wrapper = mountComponent();

            await wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).vm.$emit('submit-success', 'ctok_test');
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

            await wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(mockHandleNextAction).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
        });

        it('emits payment-failed when handleNextAction returns an error', async () => {
            mockAuthorizePayment.mockResolvedValue(stripeActionRequiredResponse);
            mockHandleNextAction.mockResolvedValue({ error: { message: 'Card declined' } });
            const wrapper = mountComponent();

            await wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).vm.$emit('submit-success', 'ctok_test');
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

            await wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(mockHandleNextAction).not.toHaveBeenCalled();
        });
    });

    describe('handleRedirectReturn', () => {
        it('emits payment-success on a succeeded redirect with matching acceptor id', async () => {
            mockGetQueryParam.mockImplementation((key: string) => {
                if (key === 'payment_acceptor_id') return 'paya_123';
                if (key === 'redirect_status') return 'succeeded';
                if (key === 'payment_intent_client_secret') return 'pi_secret_redirect';
                return null;
            });

            const wrapper = mountComponent();
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('emits payment-failed on a failed redirect', async () => {
            mockGetQueryParam.mockImplementation((key: string) => {
                if (key === 'payment_acceptor_id') return 'paya_123';
                if (key === 'redirect_status') return 'failed';
                if (key === 'payment_intent_client_secret') return 'pi_secret_redirect';
                return null;
            });

            const wrapper = mountComponent();
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
            expect(wrapper.emitted('payment-success')).toBeUndefined();
        });

        it('ignores redirect params when acceptor id does not match', async () => {
            mockGetQueryParam.mockImplementation((key: string) => {
                if (key === 'payment_acceptor_id') return 'paya_OTHER';
                if (key === 'redirect_status') return 'succeeded';
                if (key === 'payment_intent_client_secret') return 'pi_secret_redirect';
                return null;
            });

            const wrapper = mountComponent();
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });

        it('does nothing when redirect_status is absent', async () => {
            mockGetQueryParam.mockReturnValue(null);

            const wrapper = mountComponent();
            await nextTick();

            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });
    });

    describe('TOKENIZE variant', () => {
        it('calls tokenizePaymentMethod and emits payment-success on SUCCESS', async () => {
            mockTokenizePaymentMethod.mockResolvedValue(successResponse);
            const wrapper = mountComponent({ variant: 'TOKENIZE' });

            await wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(mockTokenizePaymentMethod).toHaveBeenCalled();
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('emits payment-failed when tokenizePaymentMethod throws', async () => {
            mockTokenizePaymentMethod.mockRejectedValue(new Error('network error'));
            const wrapper = mountComponent({ variant: 'TOKENIZE' });

            await wrapper.findComponent({ name: 'PaymentIntegrationFormStripeFrame' }).vm.$emit('submit-success', 'ctok_test');
            await nextTick();
            await new Promise((r) => setTimeout(r, 0));

            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
        });
    });
});
