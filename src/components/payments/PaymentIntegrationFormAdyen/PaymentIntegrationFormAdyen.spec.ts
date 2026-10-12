import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PaymentIntegrationFormAdyen from './PaymentIntegrationFormAdyen.vue';
import type { PaymentIntegrationFormAdyenProps } from './PaymentIntegrationFormAdyen.types';
import { ApiError } from '@/services/apiError';
import { getQueryParam } from '@/utils/url';

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
        activePaymentMethod: { type: 'scheme' } as { type: string } | null,
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
            onPaymentCompleted?: (data: unknown, component?: unknown) => void;
            onAdditionalDetails?: (state: unknown, component: unknown, actions: unknown) => void;
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
/** Assigned onto the drop-in after the fact, since it hands back the drop-in itself. */
const mockDropInMount = (adyen.dropIn as unknown as { mount: ReturnType<typeof vi.fn> }).mount;

vi.mock('@adyen/adyen-web', () => ({
    AdyenCheckout: (config: Record<string, unknown>) => {
        adyen.captured.checkoutConfig = config;
        return adyen.checkout(config) ?? Promise.resolve({ config });
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
        adyen.dropIn.activePaymentMethod = { type: 'scheme' };
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

        it('says no payment method is chosen when none is open in the drop-in', async () => {
            adyen.dropIn.isValid = false;
            adyen.dropIn.activePaymentMethod = null;
            const wrapper = await mountComponent();

            (wrapper.vm as unknown as { submit: () => void }).submit();

            expect(adyen.dropIn.submit).not.toHaveBeenCalled();
            expect(wrapper.emitted('invalid')).toEqual([['NO_PAYMENT_METHOD']]);
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

        it('reports the submit as invalid when the screen fails to validate', async () => {
            const wrapper = await mountComponent({
                validateOnSubmit: () => Promise.reject(new Error('validation threw')),
            });

            await submitThroughDropIn();

            expect(adyen.dropIn.setStatus).toHaveBeenCalledWith('ready');
            expect(wrapper.emitted('invalid')).toHaveLength(1);
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

            // Resolving with the action is what runs it; running it as well ran 3DS twice.
            expect(mockHandleAction).not.toHaveBeenCalled();
            expect(actions.resolve).toHaveBeenCalledWith(
                expect.objectContaining({
                    resultCode: 'RedirectShopper',
                    action: expect.objectContaining({ type: 'redirect', paymentData: 'pd_1' }),
                }),
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

        it('reports the failure and resolves as an error when the API turns the request down', async () => {
            const error = new ApiError({ statusCode: 422 });
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

    describe('outcomes that are not known yet', () => {
        const failedCode = (wrapper: Awaited<ReturnType<typeof mountComponent>>) =>
            (wrapper.emitted('payment-failed')?.[0]?.[0] as { code: string } | undefined)?.code;

        // SEPA and other asynchronous methods answer SUCCESS with the payment still PENDING;
        // reading only `AUTHORIZED` turned that into a failure and a second payment.
        it('leaves a pending payment unconfirmed and takes the drop-in away', async () => {
            mockAuthorizePayment.mockResolvedValue({
                status: 'SUCCESS',
                payment: { result: 'PENDING' },
            });

            const wrapper = await mountComponent();
            const actions = await submitThroughDropIn();

            expect(failedCode(wrapper)).toBe('PAYMENT_OUTCOME_UNCONFIRMED');
            expect(wrapper.emitted('payment-success')).toBeUndefined();
            expect(actions.resolve).not.toHaveBeenCalled();
            expect(adyen.dropIn.unmount).toHaveBeenCalled();
        });

        it.each([
            ['the request never got an answer', new TypeError('Failed to fetch')],
            ['the server failed', new ApiError({ statusCode: 503 })],
        ])('does not offer a retry when %s', async (_, error) => {
            mockAuthorizePayment.mockRejectedValue(error);

            const wrapper = await mountComponent();
            const actions = await submitThroughDropIn();

            expect(failedCode(wrapper)).toBe('PAYMENT_OUTCOME_UNCONFIRMED');
            expect(actions.resolve).not.toHaveBeenCalled();
            expect(adyen.dropIn.unmount).toHaveBeenCalled();
        });
    });

    describe('additional details from the drop-in', () => {
        const sendDetails = async () => {
            const actions = { resolve: vi.fn(), reject: vi.fn() };
            captured.checkoutConfig?.onAdditionalDetails?.(
                { data: { details: { threeDSResult: 'abc' } } },
                {},
                actions,
            );
            await flushPromises();
            return actions;
        };

        it('answers the drop-in as authorised when the payment succeeded', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            await mountComponent();

            const actions = await sendDetails();

            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Authorised' });
        });

        // Ignoring REFUSED left the drop-in's spinner turning for good.
        it('answers the drop-in as refused when the payment was refused', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'REFUSED' });
            await mountComponent();

            const actions = await sendDetails();

            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Refused' });
        });

        it.each([
            [
                'an action is still required',
                () =>
                    mockGetPaymentDetails.mockResolvedValue({ payment_status: 'ACTION_REQUIRED' }),
            ],
            [
                'the call fails',
                () => mockGetPaymentDetails.mockRejectedValue(new TypeError('Failed to fetch')),
            ],
        ])('leaves the payment unconfirmed when %s', async (_, arrange) => {
            arrange();
            const wrapper = await mountComponent();

            await sendDetails();

            expect((wrapper.emitted('payment-failed')?.[0]?.[0] as { code: string }).code).toBe(
                'PAYMENT_OUTCOME_UNCONFIRMED',
            );
            expect(adyen.dropIn.unmount).toHaveBeenCalled();
        });

        it('shows the completed card once the drop-in reports the payment completed', async () => {
            const wrapper = await mountComponent();

            captured.checkoutConfig?.onPaymentCompleted?.({ resultCode: 'Authorised' });
            await flushPromises();

            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(wrapper.findComponent({ name: 'PaymentCompletedCard' }).exists()).toBe(true);
        });
    });

    describe('returning from a redirect', () => {
        beforeEach(() => {
            vi.mocked(getQueryParam).mockImplementation(
                (key: string) =>
                    ({ redirectResult: 'res_1', payment_acceptor_id: 'paya_123' })[key] ?? null,
            );
        });

        afterEach(() => {
            vi.mocked(getQueryParam).mockImplementation(() => null);
        });

        // PayInvoice relies on the card: without it, "Pay" stayed on screen after a payment.
        it('shows the completed card and keeps the drop-in away after a successful payment', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });

            const wrapper = await mountComponent();

            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(wrapper.findComponent({ name: 'PaymentCompletedCard' }).exists()).toBe(true);
            expect(mockAdyenCheckout).not.toHaveBeenCalled();
        });

        it('offers the drop-in again once the payment is known to have failed', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'REFUSED' });

            const wrapper = await mountComponent();

            expect((wrapper.emitted('payment-failed')?.[0]?.[0] as { code: string }).code).toBe(
                'AUTHORIZATION_FAILED',
            );
            expect(mockAdyenCheckout).toHaveBeenCalledTimes(1);
        });

        it('keeps the drop-in away while the outcome is unconfirmed', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'ACTION_REQUIRED' });

            const wrapper = await mountComponent();

            expect((wrapper.emitted('payment-failed')?.[0]?.[0] as { code: string }).code).toBe(
                'PAYMENT_OUTCOME_UNCONFIRMED',
            );
            expect(mockAdyenCheckout).not.toHaveBeenCalled();
        });

        it('keeps the drop-in away when the payment could not be checked', async () => {
            mockGetPaymentDetails.mockRejectedValue(new TypeError('Failed to fetch'));

            const wrapper = await mountComponent();

            expect((wrapper.emitted('payment-failed')?.[0]?.[0] as { code: string }).code).toBe(
                'PAYMENT_DETAILS_CALL_FAILED',
            );
            expect(mockAdyenCheckout).not.toHaveBeenCalled();
        });
    });

    describe('TOKENIZE', () => {
        const tokenizeProps = { variant: 'TOKENIZE' as const };

        it('hands an action back to the drop-in and resolves with its result code', async () => {
            mockTokenizePaymentMethod.mockResolvedValue(actionRequiredResponse);

            await mountComponent(tokenizeProps);
            const actions = await submitThroughDropIn();

            // Resolving with the action is what runs it; running it as well ran 3DS twice.
            expect(mockHandleAction).not.toHaveBeenCalled();
            expect(actions.resolve).toHaveBeenCalledWith(
                expect.objectContaining({
                    resultCode: 'RedirectShopper',
                    action: expect.objectContaining({ type: 'redirect', paymentData: 'pd_1' }),
                }),
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
            const wrapper = await mountComponent();

            captured.checkoutConfig?.onError?.({ name: 'CANCEL' });
            await flushPromises();

            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });

        it('lets the screen stop waiting when the customer cancels', async () => {
            const wrapper = await mountComponent();

            captured.checkoutConfig?.onError?.({ name: 'CANCEL' });
            await flushPromises();

            expect(wrapper.emitted('invalid')).toHaveLength(1);
        });

        it('shows no error card when the customer cancels', async () => {
            const wrapper = await mountComponent();

            captured.checkoutConfig?.onError?.({ name: 'CANCEL' });
            await flushPromises();

            expect(reference(wrapper).exists()).toBe(false);
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });

        it('reports a throwing validation as invalid once, and never as a failure', async () => {
            const wrapper = await mountComponent({
                validateOnSubmit: () => Promise.reject(new Error('validation threw')),
            });

            const actions = await submitThroughDropIn();

            expect(wrapper.emitted('invalid')).toHaveLength(1);
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
            expect(actions.reject).not.toHaveBeenCalled();
            expect(reference(wrapper).exists()).toBe(false);
        });
    });

    describe('settled outcomes stay settled', () => {
        const errorCard = (wrapper: Awaited<ReturnType<typeof mountComponent>>) =>
            wrapper.find('[data-testid="payment-error-reference"]');
        const failedCodes = (wrapper: Awaited<ReturnType<typeof mountComponent>>) =>
            (wrapper.emitted('payment-failed') ?? []).map(([e]) => (e as { code: string }).code);

        afterEach(() => {
            vi.mocked(getQueryParam).mockImplementation(() => null);
        });

        // The drop-in mounting afterwards clears `integrationError`, which took the card with it.
        it.each(['REFUSED', 'FAILURE'])(
            'keeps the failure card on screen after a redirect return answered %s',
            async (paymentStatus) => {
                vi.mocked(getQueryParam).mockImplementation(
                    (key: string) =>
                        ({ redirectResult: 'res_1', payment_acceptor_id: 'paya_123' })[key] ?? null,
                );
                mockGetPaymentDetails.mockResolvedValue({ payment_status: paymentStatus });

                const wrapper = await mountComponent();

                expect(failedCodes(wrapper)).toEqual(['AUTHORIZATION_FAILED']);
                expect(errorCard(wrapper).exists()).toBe(true);
            },
        );

        it('shows the failure card once the drop-in reports a refused 3DS result', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'REFUSED' });
            const wrapper = await mountComponent();

            const actions = { resolve: vi.fn(), reject: vi.fn() };
            captured.checkoutConfig?.onAdditionalDetails?.(
                { data: { details: { threeDSResult: 'abc' } } },
                {},
                actions,
            );
            await flushPromises();
            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Refused' });

            // What the drop-in does with a Refused answer.
            captured.checkoutConfig?.onPaymentFailed?.({ resultCode: 'Refused' });
            await flushPromises();

            expect(failedCodes(wrapper)).toEqual(['AUTHORIZATION_FAILED']);
            expect(errorCard(wrapper).exists()).toBe(true);
            expect(wrapper.emitted('payment-success')).toBeUndefined();
        });

        it('emits payment-success once when an authorised 3DS result completes', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            const wrapper = await mountComponent();

            const actions = { resolve: vi.fn(), reject: vi.fn() };
            captured.checkoutConfig?.onAdditionalDetails?.(
                { data: { details: { threeDSResult: 'abc' } } },
                {},
                actions,
            );
            await flushPromises();
            captured.checkoutConfig?.onPaymentCompleted?.({}, { unmount: vi.fn() });
            await flushPromises();

            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('emits payment-success once for an authorised submit', async () => {
            mockAuthorizePayment.mockResolvedValue(authorizedResponse);
            const wrapper = await mountComponent();

            const actions = await submitThroughDropIn();
            expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Authorised' });
            expect(wrapper.emitted('payment-success')).toBeUndefined();

            captured.checkoutConfig?.onPaymentCompleted?.({}, { unmount: vi.fn() });
            await flushPromises();
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it.each([400, 402, 409, 422])(
            'still reports a failure the API turned down (%i)',
            async (statusCode) => {
                mockAuthorizePayment.mockRejectedValue(new ApiError({ statusCode }));
                const wrapper = await mountComponent();

                const actions = await submitThroughDropIn();

                expect(actions.resolve).toHaveBeenCalledWith({ resultCode: 'Error' });
                expect(failedCodes(wrapper)).not.toContain('PAYMENT_OUTCOME_UNCONFIRMED');
            },
        );

        it.each([408, 500, 502, 504])(
            'leaves an authorize the API could not answer unconfirmed (%i)',
            async (statusCode) => {
                mockAuthorizePayment.mockRejectedValue(new ApiError({ statusCode }));
                const wrapper = await mountComponent();

                const actions = await submitThroughDropIn();

                expect(actions.resolve).not.toHaveBeenCalled();
                expect(failedCodes(wrapper)).toEqual(['PAYMENT_OUTCOME_UNCONFIRMED']);
            },
        );

        it('does not bring the drop-in back when the options change after an unconfirmed outcome', async () => {
            mockAuthorizePayment.mockResolvedValue({
                status: 'SUCCESS',
                payment: { result: 'PENDING' },
            });
            const wrapper = await mountComponent();
            await submitThroughDropIn();
            expect(mockAdyenCheckout).toHaveBeenCalledTimes(1);

            await wrapper.setProps({
                paymentMethodOptionResponseEntry: {
                    ...mockProps.paymentMethodOptionResponseEntry,
                    payment_acceptor: { id: 'paya_456' },
                } as never,
            });
            await flushPromises();

            expect(mockAdyenCheckout).toHaveBeenCalledTimes(1);
            expect(failedCodes(wrapper)).toEqual(['PAYMENT_OUTCOME_UNCONFIRMED']);
            expect(wrapper.text()).toContain('Payment not confirmed yet');
        });

        it('does not bring the drop-in back when the options change after a success', async () => {
            mockAuthorizePayment.mockResolvedValue(authorizedResponse);
            const wrapper = await mountComponent();
            await submitThroughDropIn();
            captured.checkoutConfig?.onPaymentCompleted?.({}, { unmount: vi.fn() });
            await flushPromises();

            await wrapper.setProps({
                paymentMethodOptionResponseEntry: {
                    ...mockProps.paymentMethodOptionResponseEntry,
                    payment_acceptor: { id: 'paya_456' },
                } as never,
            });
            await flushPromises();

            expect(mockAdyenCheckout).toHaveBeenCalledTimes(1);
            expect(wrapper.findComponent({ name: 'PaymentCompletedCard' }).exists()).toBe(true);
        });
    });

    describe('the redirect return in the address', () => {
        const visit = (search: string) => window.history.replaceState(null, '', `/pay${search}`);
        const returnTo = (query: Record<string, string>) => {
            visit(`?${new URLSearchParams({ coupon_code: 'SAVE', ...query })}`);
            vi.mocked(getQueryParam).mockImplementation((key: string) => query[key] ?? null);
        };

        afterEach(() => {
            visit('');
            vi.mocked(getQueryParam).mockImplementation(() => null);
        });

        it('is taken out once handled, so a reload cannot send it again', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'REFUSED' });
            returnTo({ redirectResult: 'res_1', payment_acceptor_id: 'paya_123' });

            await mountComponent();

            expect(window.location.search).toBe('?coupon_code=SAVE');
        });

        it('is left to the form of the acceptor it names', async () => {
            returnTo({ redirectResult: 'res_1', payment_acceptor_id: 'paya_other' });

            const wrapper = await mountComponent();

            expect(mockGetPaymentDetails).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
            expect(mockAdyenCheckout).toHaveBeenCalledTimes(1);
            expect(window.location.search).toContain('redirectResult=res_1');
        });

        // The address already decoded it; decoding it again could only mangle it.
        it('is sent on as the address decoded it', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            returnTo({ redirectResult: 'X6XtfGC3!H4sI+/=', payment_acceptor_id: 'paya_123' });

            const wrapper = await mountComponent();

            expect(mockGetPaymentDetails).toHaveBeenCalledWith(
                expect.objectContaining({
                    adyen: { details: { redirectResult: 'X6XtfGC3!H4sI+/=' } },
                }),
            );
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('is not sent on when no gateway could have written it', async () => {
            returnTo({ redirectResult: 'not a result', payment_acceptor_id: 'paya_123' });

            const wrapper = await mountComponent();

            expect(mockGetPaymentDetails).not.toHaveBeenCalled();
            expect((wrapper.emitted('payment-failed')?.[0]?.[0] as { code: string }).code).toBe(
                'PAYMENT_OUTCOME_UNCONFIRMED',
            );
        });
    });

    describe('trying again', () => {
        const retry = async (wrapper: Awaited<ReturnType<typeof mountComponent>>) => {
            wrapper.findComponent({ name: 'PaymentErrorCard' }).vm.$emit('retry');
            await flushPromises();
        };

        afterEach(() => {
            vi.mocked(getQueryParam).mockImplementation(() => null);
        });

        it('asks again about the payment it could not check, then shows the outcome', async () => {
            vi.mocked(getQueryParam).mockImplementation(
                (key: string) =>
                    ({ redirectResult: 'res_1', payment_acceptor_id: 'paya_123' })[key] ?? null,
            );
            mockGetPaymentDetails
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce({ payment_status: 'SUCCESS' });

            const wrapper = await mountComponent();
            await retry(wrapper);

            expect(mockGetPaymentDetails).toHaveBeenCalledTimes(2);
            expect(mockGetPaymentDetails).toHaveBeenLastCalledWith(
                expect.objectContaining({ adyen: { details: { redirectResult: 'res_1' } } }),
            );
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(mockAdyenCheckout).not.toHaveBeenCalled();
        });

        it('builds a fresh drop-in after a failed payment, without asking about it again', async () => {
            const wrapper = await mountComponent();
            captured.checkoutConfig?.onPaymentFailed?.({ resultCode: 'Refused' });
            await flushPromises();

            await retry(wrapper);

            expect(wrapper.findComponent({ name: 'PaymentErrorCard' }).exists()).toBe(false);
            expect(mockAdyenCheckout).toHaveBeenCalledTimes(2);
            expect(mockGetPaymentDetails).not.toHaveBeenCalled();
        });

        // The drop-in mounting after the second answer would otherwise take the card with it.
        it('keeps the card when asking again finds the payment refused', async () => {
            vi.mocked(getQueryParam).mockImplementation(
                (key: string) =>
                    ({ redirectResult: 'res_1', payment_acceptor_id: 'paya_123' })[key] ?? null,
            );
            mockGetPaymentDetails
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce({ payment_status: 'REFUSED' });

            const wrapper = await mountComponent();
            await retry(wrapper);

            expect(
                (wrapper.emitted('payment-failed')?.[1]?.[0] as { code: string } | undefined)?.code,
            ).toBe('AUTHORIZATION_FAILED');
            expect(wrapper.findComponent({ name: 'PaymentErrorCard' }).exists()).toBe(true);
            expect(mockAdyenCheckout).toHaveBeenCalledTimes(1);
        });
    });

    describe('mounting', () => {
        function holdCheckout() {
            let release: () => void = () => {};
            mockAdyenCheckout.mockImplementationOnce(
                (config: unknown) =>
                    new Promise((resolve) => {
                        release = () => resolve({ config });
                    }),
            );
            return () => release();
        }

        it('builds nothing once the form has gone', async () => {
            const release = holdCheckout();
            const wrapper = await mountComponent();

            wrapper.unmount();
            release();
            await flushPromises();

            expect(mockDropInMount).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('builds one drop-in when a rebuild overtakes the first build', async () => {
            const release = holdCheckout();
            const wrapper = await mountComponent();

            await wrapper.setProps({
                paymentMethodOptionResponseEntry: {
                    ...mockProps.paymentMethodOptionResponseEntry,
                    payment_acceptor: { id: 'paya_456' },
                } as never,
            });
            await flushPromises();
            release();
            await flushPromises();

            expect(mockDropInMount).toHaveBeenCalledTimes(1);
        });

        // The overtaken mount used to put the returned payment's card back over the rebuilt form.
        it('leaves a refused return cleared once a rebuild overtakes the first build', async () => {
            vi.mocked(getQueryParam).mockImplementation(
                (key: string) =>
                    ({ redirectResult: 'res_1', payment_acceptor_id: 'paya_123' })[key] ?? null,
            );
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'REFUSED' });
            const release = holdCheckout();
            const wrapper = await mountComponent();

            await wrapper.setProps({
                paymentMethodOptionResponseEntry: {
                    ...mockProps.paymentMethodOptionResponseEntry,
                    payment_acceptor: { id: 'paya_456' },
                } as never,
            });
            await flushPromises();
            release();
            await flushPromises();

            expect(wrapper.findComponent({ name: 'PaymentErrorCard' }).exists()).toBe(false);
            expect(mockDropInMount).toHaveBeenCalledTimes(1);
            vi.mocked(getQueryParam).mockImplementation(() => null);
        });

        it('adds its styles to the shadow root once, however often it is rebuilt', async () => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            const shadowRoot = host.attachShadow({ mode: 'open' });
            const target = document.createElement('div');
            shadowRoot.appendChild(target);

            const wrapper = mount(PaymentIntegrationFormAdyen, {
                props: mockProps,
                attachTo: target,
            });
            await flushPromises();
            await wrapper.setProps({
                paymentMethodOptionResponseEntry: {
                    ...mockProps.paymentMethodOptionResponseEntry,
                    payment_acceptor: { id: 'paya_456' },
                } as never,
            });
            await flushPromises();

            expect(mockDropInMount).toHaveBeenCalledTimes(2);
            expect(shadowRoot.querySelectorAll('style')).toHaveLength(3);

            wrapper.unmount();
            host.remove();
        });
    });

    // The challenge is drawn inside the form, which the screen holds while a payment is pending.
    it('tells the screen when it hands the customer a step to complete', async () => {
        mockAuthorizePayment.mockResolvedValue(actionRequiredResponse);
        const wrapper = await mountComponent();

        await submitThroughDropIn();

        expect(wrapper.emitted('action-required')).toHaveLength(1);
    });

    describe('a submit the form starts itself', () => {
        it('tells the screen a payment is on its way', async () => {
            mockAuthorizePayment.mockResolvedValue(authorizedResponse);
            const wrapper = await mountComponent();

            await submitThroughDropIn();

            expect(wrapper.emitted('submitting')).toHaveLength(1);
        });

        it('tells the screen nothing when the screen turns it down', async () => {
            const wrapper = await mountComponent({
                validateOnSubmit: () => Promise.resolve(false),
            });

            await submitThroughDropIn();

            expect(wrapper.emitted('submitting')).toBeUndefined();
        });

        // Enter in a card field followed by Pay authorized the same payment twice.
        it('sends one payment while another is on its way', async () => {
            mockAuthorizePayment.mockReturnValue(new Promise(() => {}));
            const wrapper = await mountComponent();

            await submitThroughDropIn();
            await submitThroughDropIn();
            (wrapper.vm as unknown as { submit: () => void }).submit();
            await flushPromises();

            expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
            expect(adyen.dropIn.submit).not.toHaveBeenCalled();
            expect(wrapper.emitted('invalid')).toBeUndefined();
        });

        it('takes a new payment once the last one has failed', async () => {
            mockAuthorizePayment.mockResolvedValue(refusedResponse);
            await mountComponent();

            await submitThroughDropIn();
            captured.checkoutConfig?.onPaymentFailed?.({ resultCode: 'Error' });
            await submitThroughDropIn();

            expect(mockAuthorizePayment).toHaveBeenCalledTimes(2);
        });

        it('takes a new payment once the screen has turned the last one down', async () => {
            const validateOnSubmit = vi
                .fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);
            mockAuthorizePayment.mockResolvedValue(authorizedResponse);
            await mountComponent({ validateOnSubmit });

            await submitThroughDropIn();
            await submitThroughDropIn();

            expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
        });

        it('takes a new payment once the customer closed a wallet', async () => {
            mockAuthorizePayment.mockResolvedValue(actionRequiredResponse);
            await mountComponent();

            await submitThroughDropIn();
            captured.checkoutConfig?.onError?.({ name: 'CANCEL' });
            await submitThroughDropIn();

            expect(mockAuthorizePayment).toHaveBeenCalledTimes(2);
        });
    });
});
