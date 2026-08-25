import { flushPromises, mount } from '@vue/test-utils';
import PaymentIntegrationFormAdyen from './PaymentIntegrationFormAdyen.vue';
import type { PaymentIntegrationFormAdyenProps } from './PaymentIntegrationFormAdyen.types';

type SubmitActions = { resolve: (result: unknown) => void; reject: () => void };

/** The one entry point of Adyen's checkout configuration these tests drive. */
type SubmitHandler = (state: unknown, component: unknown, actions: SubmitActions) => unknown;

/**
 * Held here rather than as plain consts: the mock factory below is hoisted above the module body,
 * so anything it closes over has to be hoisted with it.
 */
const adyen = vi.hoisted(() => {
    /** Every payment method component the drop-in is configured with, in the order it lists them. */
    const componentNames = [
        'Card',
        'Bancontact',
        'Ach',
        'AmazonPay',
        'ApplePay',
        'BcmcMobile',
        'BacsDirectDebit',
        'CashAppPay',
        'EPS',
        'GooglePay',
        'Klarna',
        'PayByBank',
        'PayPal',
        'SepaDirectDebit',
        'Trustly',
        'Twint',
        'PayByBankUS',
        'Redirect',
    ];
    const handleAction = vi.fn();
    const dropIn = { handleAction, unmount: vi.fn(), submit: vi.fn() };
    Object.assign(dropIn, { mount: vi.fn(() => dropIn) });

    const captured: {
        checkoutConfig?: { onSubmit?: SubmitHandler };
        dropInConfig?: { paymentMethodComponents?: { name: string }[] };
    } = {};

    return { componentNames, handleAction, dropIn, checkout: vi.fn(), captured };
});

const mockAuthorizePayment = vi.fn();
const mockGetPaymentDetails = vi.fn();
const mockTokenizePaymentMethod = vi.fn();
const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mockHandleAction = adyen.handleAction;
const mockAdyenCheckout = adyen.checkout;
const captured = adyen.captured;

vi.mock('@adyen/adyen-web', () => ({
    AdyenCheckout: (config: { onSubmit?: SubmitHandler }) => {
        adyen.captured.checkoutConfig = config;
        adyen.checkout(config);
        return Promise.resolve({ config });
    },
    Dropin: function Dropin(
        _checkout: unknown,
        config: { paymentMethodComponents?: { name: string }[] },
    ) {
        adyen.captured.dropInConfig = config;
        return adyen.dropIn;
    },
    ...Object.fromEntries(adyen.componentNames.map((name) => [name, { name }])),
}));

vi.mock('@adyen/adyen-web/styles/adyen.css?inline', () => ({ default: '' }));

vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({
        authorizePayment: mockAuthorizePayment,
        getPaymentDetails: mockGetPaymentDetails,
    }),
}));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({ tokenizePaymentMethod: mockTokenizePaymentMethod }),
}));

vi.mock('@/utils/adyen', () => ({
    createReturnUrl: vi.fn(() => 'https://example.com/return'),
    getAdyenClientKeyFromPaymentMethodOptionsResponse: vi.fn(() => 'test_client_key'),
    getAdyenEnvironmentFromPaymentMethodOptionsResponse: vi.fn(() => 'test'),
    mapAdyenPaymentMethods: vi.fn(() => []),
    PAYMENT_ACCEPTOR_ID_QUERY_STRING: 'payment_acceptor_id',
    REDIRECT_RESULT_QUERY_STRING: 'redirectResult',
    transformObjectToAdyenObject: vi.fn((value: unknown) => value),
}));

vi.mock('@/utils/amount', () => ({
    toMinorUnitAmount: vi.fn(() => ({ value: 999, currency: 'EUR' })),
}));

vi.mock('@/utils/paymentMethods', () => ({ filterOutExpressPaymentMethods: vi.fn(() => []) }));

vi.mock('@/utils/url', () => ({ getQueryParam: vi.fn(() => null) }));

vi.mock('@/components/providers', () => ({ useLogger: () => mockLogger }));

vi.mock(
    '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature',
    async () => {
        const { ref } = await import('vue');
        return { useExperimentalFeature: () => ref({}) };
    },
);

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const mockProps: PaymentIntegrationFormAdyenProps = {
    countryCode: 'NL',
    customerId: 'cust_123',
    paymentMethodOptionResponseEntry: {
        payment_acceptor: { id: 'paya_123' },
        integration: { payment_gateway: { variant: 'ADYEN' } },
        options: [],
    } as unknown as PaymentIntegrationFormAdyenProps['paymentMethodOptionResponseEntry'],
    variant: 'AUTHORIZE',
    selected: true,
    amount: { currency: 'EUR', quantity: '9.99' },
    context: {
        type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
        init_pricing_plan_subscription: {
            template_pricing_plan_subscription_id: 'ppsu_abc',
            customer_details: { email: 'test@example.com', type: 'INDIVIDUAL' },
        },
    } as unknown as PaymentIntegrationFormAdyenProps['context'],
};

const submitState = {
    data: {
        paymentMethod: { type: 'scheme' },
        riskData: {},
        browserInfo: {},
        storePaymentMethod: false,
    },
};

const actionRequiredResponse = {
    status: 'ACTION_REQUIRED',
    action: {
        payment_gateway_variant: 'ADYEN',
        method: 'POST',
        url: 'https://adyen.test/3ds',
        data: {},
        adyen: {
            result_code: 'RedirectShopper',
            action_type: 'redirect',
            payment_method_type: 'scheme',
            payment_data: 'pd_1',
            sdk_data: undefined,
        },
    },
};

const authorizedResponse = { status: 'SUCCESS', payment: { result: 'AUTHORIZED' } };
const refusedResponse = { status: 'SUCCESS', payment: { result: 'REFUSED' } };

async function mountComponent(props: Partial<PaymentIntegrationFormAdyenProps> = {}) {
    const wrapper = mount(PaymentIntegrationFormAdyen, { props: { ...mockProps, ...props } });
    await flushPromises();
    return wrapper;
}

/** Drives the drop-in's submit the way Adyen does, and reports what it was answered with. */
async function submitThroughDropIn() {
    const actions = { resolve: vi.fn(), reject: vi.fn() };

    await captured.checkoutConfig?.onSubmit?.(submitState, {}, actions);
    await flushPromises();

    return actions;
}

describe('PaymentIntegrationFormAdyen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captured.checkoutConfig = undefined;
        captured.dropInConfig = undefined;
    });

    it('builds the drop-in with every payment method component', async () => {
        await mountComponent();

        expect(mockAdyenCheckout).toHaveBeenCalledTimes(1);
        expect(captured.dropInConfig?.paymentMethodComponents).toHaveLength(
            adyen.componentNames.length,
        );
        expect(
            captured.dropInConfig?.paymentMethodComponents?.map(
                (c) => (c as { name: string }).name,
            ),
        ).toEqual(adyen.componentNames);
    });

    describe('AUTHORIZE', () => {
        it('hands an action back to the drop-in and resolves with its result code', async () => {
            mockAuthorizePayment.mockResolvedValue(actionRequiredResponse);

            await mountComponent();
            const actions = await submitThroughDropIn();

            expect(mockHandleAction).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'redirect', paymentData: 'pd_1' }),
            );
            expect(actions.resolve).toHaveBeenCalledWith(
                expect.objectContaining({ resultCode: 'RedirectShopper' }),
            );
        });

        it('shows the completed card and resolves as authorised when the payment goes through', async () => {
            mockAuthorizePayment.mockResolvedValue(authorizedResponse);

            const wrapper = await mountComponent();
            const actions = await submitThroughDropIn();

            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Authorised' });
            expect(wrapper.findComponent({ name: 'PaymentCompletedCard' }).exists()).toBe(true);
        });

        it('reports the failure and resolves as an error on any other result', async () => {
            mockAuthorizePayment.mockResolvedValue(refusedResponse);

            await mountComponent();
            const actions = await submitThroughDropIn();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'PAYMENT_AUTHORIZATION_FAILED',
                expect.stringContaining('paya_123'),
                { error: refusedResponse },
            );
            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Error' });
        });

        it('reports the failure and resolves as an error when the request rejects', async () => {
            const error = new Error('network');
            mockAuthorizePayment.mockRejectedValue(error);

            await mountComponent();
            const actions = await submitThroughDropIn();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'PAYMENT_AUTHORIZATION_FAILED',
                expect.stringContaining('paya_123'),
                { error },
            );
            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Error' });
        });
    });

    describe('TOKENIZE', () => {
        const tokenizeProps = { variant: 'TOKENIZE' as const };

        it('hands an action back to the drop-in and resolves with its result code', async () => {
            mockTokenizePaymentMethod.mockResolvedValue(actionRequiredResponse);

            await mountComponent(tokenizeProps);
            const actions = await submitThroughDropIn();

            expect(mockHandleAction).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'redirect', paymentData: 'pd_1' }),
            );
            expect(actions.resolve).toHaveBeenCalledWith(
                expect.objectContaining({ resultCode: 'RedirectShopper' }),
            );
        });

        it('shows the completed card and resolves as authorised when the method is stored', async () => {
            mockTokenizePaymentMethod.mockResolvedValue(authorizedResponse);

            const wrapper = await mountComponent(tokenizeProps);
            const actions = await submitThroughDropIn();

            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Authorised' });
            expect(wrapper.findComponent({ name: 'PaymentCompletedCard' }).exists()).toBe(true);
        });

        it('reports the failure under its own code and resolves as an error', async () => {
            mockTokenizePaymentMethod.mockResolvedValue(refusedResponse);

            await mountComponent(tokenizeProps);
            const actions = await submitThroughDropIn();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'TOKENIZATION_FAILED',
                expect.stringContaining('paya_123'),
                { error: refusedResponse },
            );
            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Error' });
        });

        it('asks for nothing without a customer to store the method against', async () => {
            await mountComponent({ ...tokenizeProps, customerId: undefined });
            await submitThroughDropIn();

            expect(mockTokenizePaymentMethod).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'TOKENIZATION_FAILED',
                expect.stringContaining('Missing customer id'),
            );
        });
    });
});
