import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
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

    /**
     * The drop-in writes a card per offered method, with the modifier Adyen builds from the type.
     * Without it the container stays empty and nothing that depends on Adyen's DOM — the SEPA
     * mandate notice — could be tested at all.
     */
    const renderCards = (container: HTMLElement, types: string[]) => {
        container.innerHTML = types
            .map(
                (type) => `
                <div class="adyen-checkout__payment-method adyen-checkout__payment-method--${type}">
                    <div class="adyen-checkout__payment-method__details">
                        <div class="adyen-checkout__payment-method__details__content"></div>
                    </div>
                </div>`,
            )
            .join('');
    };

    const dropIn = {
        handleAction,
        unmount: vi.fn(),
        submit: vi.fn(),
        showValidation: vi.fn(),
        setStatus: vi.fn(),
        isValid: true,
        renderCards,
    };
    Object.assign(dropIn, {
        mount: vi.fn((container: HTMLElement) => {
            const offered: { type: string }[] =
                captured.checkoutConfig?.paymentMethodsResponse?.paymentMethods ?? [];
            renderCards(
                container,
                offered.map(({ type }) => type),
            );
            return dropIn;
        }),
    });

    const captured: {
        checkoutConfig?: {
            paymentMethodsResponse?: { paymentMethods: { type: string }[] };
            onSubmit?: SubmitHandler;
            onPaymentFailed?: (data: unknown, component?: unknown) => void;
            onError?: (data: unknown, component?: unknown) => void;
        };
        dropInConfig?: {
            paymentMethodComponents?: { name: string }[];
            paymentMethodsConfiguration?: { card?: { enableStoreDetails?: boolean } };
        };
    } = {};

    /** Empty stands for the live entry that arrives with no options. */
    const getDropInPaymentMethods = vi.fn(() => [{ type: 'scheme', name: 'Card' }]);

    return {
        componentNames,
        handleAction,
        dropIn,
        checkout: vi.fn(),
        captured,
        getDropInPaymentMethods,
    };
});

const mockAuthorizePayment = vi.fn();
const mockGetPaymentDetails = vi.fn();
const mockTokenizePaymentMethod = vi.fn();
const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mockGetAdyenDropInPaymentMethods = adyen.getDropInPaymentMethods;
const mockHandleAction = adyen.handleAction;
const mockAdyenCheckout = adyen.checkout;
const captured = adyen.captured;

vi.mock('@adyen/adyen-web', () => ({
    AdyenCheckout: (config: Record<string, unknown>) => {
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
    getAdyenDropInPaymentMethods: adyen.getDropInPaymentMethods,
    getAdyenEnvironmentFromPaymentMethodOptionsResponse: vi.fn(() => 'test'),
    PAYMENT_ACCEPTOR_ID_QUERY_STRING: 'payment_acceptor_id',
    REDIRECT_RESULT_QUERY_STRING: 'redirectResult',
    transformObjectToAdyenObject: vi.fn((value: unknown) => value),
}));

vi.mock('@/utils/amount', () => ({
    toMinorUnitAmount: vi.fn(() => ({ value: 999, currency: 'EUR' })),
}));

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
        integration: { id: 'int_123', payment_gateway: { variant: 'ADYEN' } },
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
async function submitThroughDropIn(state: unknown = submitState) {
    const actions = { resolve: vi.fn(), reject: vi.fn() };

    await captured.checkoutConfig?.onSubmit?.(state, {}, actions);
    await flushPromises();

    return actions;
}

describe('PaymentIntegrationFormAdyen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAdyenDropInPaymentMethods.mockReturnValue([{ type: 'scheme', name: 'Card' }]);
        captured.checkoutConfig = undefined;
        captured.dropInConfig = undefined;
        adyen.dropIn.isValid = true;
    });

    describe('submitting', () => {
        it('hands a valid submit to the drop-in', async () => {
            const wrapper = await mountComponent();

            (wrapper.vm as unknown as { submit: () => void }).submit();

            expect(adyen.dropIn.submit).toHaveBeenCalledTimes(1);
            expect(wrapper.emitted('invalid')).toBeUndefined();
        });

        it('shows what is missing and reports the submit as invalid', async () => {
            adyen.dropIn.isValid = false;
            const wrapper = await mountComponent();

            (wrapper.vm as unknown as { submit: () => void }).submit();

            expect(adyen.dropIn.showValidation).toHaveBeenCalledTimes(1);
            expect(adyen.dropIn.submit).not.toHaveBeenCalled();
            expect(wrapper.emitted('invalid')).toHaveLength(1);
        });

        it('fails the payment when the drop-in throws on submit', async () => {
            adyen.dropIn.submit.mockImplementationOnce(() => {
                throw new Error('No active payment method.');
            });
            const wrapper = await mountComponent();

            (wrapper.vm as unknown as { submit: () => void }).submit();

            expect(wrapper.emitted('invalid')).toBeUndefined();
            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
            expect(wrapper.emitted('payment-failed')?.[0]?.[0]).toMatchObject({
                code: 'AUTHORIZATION_FAILED',
            });
        });

        it('reports the submit as invalid when the screen rejects it', async () => {
            const wrapper = await mountComponent({
                validateOnSubmit: () => Promise.resolve(false),
            });

            const actions = await submitThroughDropIn();

            expect(adyen.dropIn.setStatus).toHaveBeenCalledWith('ready');
            expect(wrapper.emitted('invalid')).toHaveLength(1);
            expect(actions.resolve).not.toHaveBeenCalled();
            expect(mockAuthorizePayment).not.toHaveBeenCalled();
        });
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

    describe('with no payment methods to build a drop-in from', () => {
        beforeEach(() => {
            mockGetAdyenDropInPaymentMethods.mockReturnValue([]);
        });

        it('mounts nothing rather than an empty drop-in', async () => {
            await mountComponent();

            expect(mockAdyenCheckout).not.toHaveBeenCalled();
            expect(captured.dropInConfig).toBeUndefined();
        });

        it('renders nothing at all, leaving the verdict to the screen around it', async () => {
            const wrapper = await mountComponent();

            expect(wrapper.find('div').exists()).toBe(false);
        });

        it('reports it as degraded, grouped by the acceptor that is misconfigured', async () => {
            await mountComponent({ invoiceId: 'invo_123' });

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'PAYMENT_INTEGRATION_NOT_RENDERABLE',
                expect.any(String),
                {
                    fingerprint: ['PAYMENT_INTEGRATION_NOT_RENDERABLE', 'paya_123'],
                    paymentAcceptorId: 'paya_123',
                    integrationId: 'int_123',
                    invoiceId: 'invo_123',
                },
            );
        });
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
                expect.objectContaining({
                    reason: 'PAYMENT_AUTHORIZATION_REJECTED',
                    gateway: 'ADYEN',
                    paymentAcceptorId: 'paya_123',
                    reference: expect.stringMatching(/^SV-/),
                }),
                refusedResponse,
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
                expect.objectContaining({
                    reason: 'PAYMENT_AUTHORIZATION_FAILED',
                    reference: expect.stringMatching(/^SV-/),
                }),
                error,
            );
            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Error' });
        });

        describe('storing the payment method', () => {
            const cardConfig = () => captured.dropInConfig?.paymentMethodsConfiguration?.card;

            /** What the drop-in reports when its own save-details checkbox is ticked. */
            const dropInWantsToStore = {
                data: { ...submitState.data, storePaymentMethod: true },
            };

            beforeEach(() => {
                mockAuthorizePayment.mockResolvedValue(authorizedResponse);
            });

            it('asks the same call that pays to store the method when the screen says so', async () => {
                await mountComponent({ storePaymentMethod: true });
                await submitThroughDropIn();

                expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
                expect(mockAuthorizePayment).toHaveBeenCalledWith(
                    expect.objectContaining({
                        adyen: expect.objectContaining({ store_payment_method: true }),
                    }),
                );
            });

            it('stores nothing when the screen says not to, whatever the drop-in reports', async () => {
                await mountComponent({ storePaymentMethod: false });
                await submitThroughDropIn(dropInWantsToStore);

                expect(mockAuthorizePayment).toHaveBeenCalledWith(
                    expect.objectContaining({
                        adyen: expect.objectContaining({ store_payment_method: false }),
                    }),
                );
            });

            it('leaves the answer to the drop-in when no screen has settled it', async () => {
                await mountComponent();
                await submitThroughDropIn(dropInWantsToStore);

                expect(mockAuthorizePayment).toHaveBeenCalledWith(
                    expect.objectContaining({
                        adyen: expect.objectContaining({ store_payment_method: true }),
                    }),
                );
            });

            it('keeps its own save-details checkbox out of the way when the screen owns it', async () => {
                await mountComponent({ storePaymentMethod: false });

                expect(cardConfig()?.enableStoreDetails).toBe(false);
            });

            it('offers its own save-details checkbox when nothing above it asks the question', async () => {
                await mountComponent();

                expect(cardConfig()?.enableStoreDetails).toBe(true);
            });
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
                expect.objectContaining({
                    reason: 'TOKENIZATION_REJECTED',
                    reference: expect.stringMatching(/^SV-/),
                }),
                refusedResponse,
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
                expect.objectContaining({ reason: 'TOKENIZATION_FAILED_NO_CUSTOMER' }),
            );
        });
    });

    describe('the SEPA mandate notice', () => {
        const SEPA_CARD = '.adyen-checkout__payment-method--sepadirectdebit';
        const NOTICE = '[data-testid="sepa-mandate-notice"]';

        const offering = (...types: string[]) =>
            mockGetAdyenDropInPaymentMethods.mockReturnValue(
                types.map((type) => ({ type, name: type })),
            );

        /** The observer runs on a microtask, so the DOM settles a tick after Adyen changes it. */
        const settle = async () => {
            await flushPromises();
            await nextTick();
            await flushPromises();
        };

        it('places the notice inside the SEPA card, not loose in the form', async () => {
            offering('sepadirectdebit');

            const wrapper = await mountComponent();
            await settle();

            expect(wrapper.find(NOTICE).exists()).toBe(true);
            expect(wrapper.find(`${SEPA_CARD} ${NOTICE}`).exists()).toBe(true);
        });

        it('names the billing entity the screen gave it', async () => {
            offering('sepadirectdebit');

            const wrapper = await mountComponent({ billingEntityName: 'ACME B.V.' });
            await settle();

            expect(wrapper.find(NOTICE).text()).toContain('you authorise ACME B.V. to instruct');
        });

        it('leaves every other payment method alone', async () => {
            offering('scheme', 'paypal');

            const wrapper = await mountComponent();
            await settle();

            expect(wrapper.find(NOTICE).exists()).toBe(false);
        });

        it('shows once when SEPA sits beside other methods', async () => {
            offering('scheme', 'sepadirectdebit', 'paypal');

            const wrapper = await mountComponent();
            await settle();

            expect(wrapper.findAll(NOTICE)).toHaveLength(1);
            expect(wrapper.find(`${SEPA_CARD} ${NOTICE}`).exists()).toBe(true);
        });

        // The card belongs to Adyen's renderer, which re-creates it whenever it likes and takes
        // our node with it. Losing a legal notice to a re-render is the failure that matters.
        it('comes back after Adyen re-creates the card', async () => {
            offering('sepadirectdebit');

            const wrapper = await mountComponent();
            await settle();
            expect(wrapper.find(NOTICE).exists()).toBe(true);

            const dropInRoot = wrapper.find(SEPA_CARD).element.parentElement as HTMLElement;
            adyen.dropIn.renderCards(dropInRoot, ['sepadirectdebit']);
            expect(wrapper.find(NOTICE).exists()).toBe(false);

            await settle();

            expect(wrapper.findAll(NOTICE)).toHaveLength(1);
            expect(wrapper.find(`${SEPA_CARD} ${NOTICE}`).exists()).toBe(true);
        });
    });

    describe('failures the drop-in reports', () => {
        const reference = (wrapper: Awaited<ReturnType<typeof mountComponent>>) =>
            wrapper.find('[data-testid="payment-error-reference"]');

        it('reports a failed payment instead of only showing the card', async () => {
            const wrapper = await mountComponent();
            const failure = { resultCode: 'Refused' };

            captured.checkoutConfig?.onPaymentFailed?.(failure);
            await flushPromises();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'ADYEN_PAYMENT_FAILED',
                'Adyen reported the payment as failed',
                expect.objectContaining({
                    reason: 'ADYEN_PAYMENT_FAILED',
                    gateway: 'ADYEN',
                    paymentAcceptorId: 'paya_123',
                    resultCode: 'Refused',
                    reference: expect.stringMatching(/^SV-/),
                }),
                failure,
            );
            expect(reference(wrapper).exists()).toBe(true);
        });

        it('gives the customer the same reference the log carries', async () => {
            const wrapper = await mountComponent();

            captured.checkoutConfig?.onPaymentFailed?.({ resultCode: 'Refused' });
            await flushPromises();

            const [, , context] = mockLogger.error.mock.calls.at(-1) as [
                string,
                string,
                { reference: string },
            ];
            expect(reference(wrapper).text()).toBe(context.reference);
        });

        it('passes the error itself on, so a consumer can report it', async () => {
            await mountComponent();
            const failure = { name: 'ERROR', message: 'drop-in blew up' };

            captured.checkoutConfig?.onError?.(failure);
            await flushPromises();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'INTEGRATION_ERROR',
                'The Adyen drop-in reported an error',
                expect.objectContaining({ reason: 'ADYEN_INTEGRATION_ERROR' }),
                failure,
            );
        });

        it('clears the card when the form is rebuilt', async () => {
            const wrapper = await mountComponent();

            captured.checkoutConfig?.onPaymentFailed?.({ resultCode: 'Refused' });
            await flushPromises();
            expect(reference(wrapper).exists()).toBe(true);

            await wrapper.setProps({
                paymentMethodOptionResponseEntry: {
                    ...mockProps.paymentMethodOptionResponseEntry,
                    payment_acceptor: { id: 'paya_456' },
                } as never,
            });
            await flushPromises();

            expect(reference(wrapper).exists()).toBe(false);
        });

        it('stays quiet when the customer cancels', async () => {
            await mountComponent();

            captured.checkoutConfig?.onError?.({ name: 'CANCEL' });
            await flushPromises();

            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });
});
