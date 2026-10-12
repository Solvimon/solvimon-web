import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PaymentIntegrationFormAdyen from './PaymentIntegrationFormAdyen.vue';
import type { PaymentIntegrationFormAdyenProps } from './PaymentIntegrationFormAdyen.types';
import { ApiError } from '@/services/apiError';

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

/*
 * DD-3538, from the tester. Unlike the implementer's spec, the address is real here: the
 * redirect return is read from `window.location` and cleared with `history.replaceState`, so what
 * a reload would see is what the next mount sees.
 */

const entry = (id: string) =>
    ({
        payment_acceptor: { id },
        integration: { id: `int_${id}`, payment_gateway: { variant: 'ADYEN' } },
    }) as unknown as PaymentIntegrationFormAdyenProps['paymentMethodOptionResponseEntry'];

const mockProps: PaymentIntegrationFormAdyenProps = {
    countryCode: 'NL',
    customerId: 'cust_123',
    paymentMethodOptionResponseEntry: entry('paya_123'),
    variant: 'AUTHORIZE',
    selected: true,
    amount: { currency: 'EUR', quantity: '9.99' },
    context: undefined as unknown as PaymentIntegrationFormAdyenProps['context'],
};

const submitState = {
    data: {
        paymentMethod: { type: 'scheme' },
        riskData: {},
        browserInfo: {},
        storePaymentMethod: false,
    },
};

const threeDsResponse = {
    status: 'ACTION_REQUIRED',
    action: {
        payment_gateway_variant: 'ADYEN',
        method: 'POST',
        url: 'https://adyen.test/3ds',
        data: {},
        adyen: {
            result_code: 'ChallengeShopper',
            action_type: 'threeDS2',
            payment_method_type: 'scheme',
            payment_data: 'pd_1',
            sdk_data: undefined,
        },
    },
};

const visit = (search: string, hash = '') =>
    window.history.replaceState(null, '', `/pay${search}${hash}`);

async function mountComponent(props: Partial<PaymentIntegrationFormAdyenProps> = {}) {
    const wrapper = mount(PaymentIntegrationFormAdyen, { props: { ...mockProps, ...props } });
    await flushPromises();
    return wrapper;
}

const newActions = () => ({ resolve: vi.fn(), reject: vi.fn() });

async function submitThroughDropIn(state: unknown = submitState) {
    const actions = newActions();
    await captured.checkoutConfig?.onSubmit?.(state, {}, actions);
    await flushPromises();
    return actions;
}

const retry = async (wrapper: Awaited<ReturnType<typeof mountComponent>>) => {
    wrapper.findComponent({ name: 'PaymentErrorCard' }).vm.$emit('retry');
    await flushPromises();
};

const failedCodes = (wrapper: Awaited<ReturnType<typeof mountComponent>>) =>
    (wrapper.emitted('payment-failed') ?? []).map(([e]) => (e as { code: string }).code);

describe('PaymentIntegrationFormAdyen (DD-3538 tester)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAdyenDropInPaymentMethods.mockReturnValue([{ type: 'scheme', name: 'Card' }]);
        captured.checkoutConfig = undefined;
        captured.dropInConfig = undefined;
        adyen.dropIn.isValid = true;
        adyen.dropIn.activePaymentMethod = { type: 'scheme' };
        visit('');
    });

    afterEach(() => visit(''));

    describe('3DS', () => {
        it('hands the action to the drop-in once, through resolve only', async () => {
            mockAuthorizePayment.mockResolvedValue(threeDsResponse);
            await mountComponent();

            const actions = await submitThroughDropIn();

            expect(mockHandleAction).not.toHaveBeenCalled();
            expect(actions.resolve).toHaveBeenCalledTimes(1);
            expect(actions.resolve).toHaveBeenCalledWith(
                expect.objectContaining({
                    resultCode: 'ChallengeShopper',
                    action: expect.objectContaining({ type: 'threeDS2' }),
                }),
            );
        });

        it('reports a successful challenge as one success and no failure', async () => {
            mockAuthorizePayment.mockResolvedValue(threeDsResponse);
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            const wrapper = await mountComponent();

            await submitThroughDropIn();
            const detailsActions = newActions();
            captured.checkoutConfig?.onAdditionalDetails?.(
                { data: { details: { threeDSResult: 'abc' } } },
                {},
                detailsActions,
            );
            await flushPromises();
            expect(detailsActions.resolve).toHaveBeenCalledWith({ resultCode: 'Authorised' });
            captured.checkoutConfig?.onPaymentCompleted?.({ resultCode: 'Authorised' });
            await flushPromises();

            expect(mockGetPaymentDetails).toHaveBeenCalledTimes(1);
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
        });
    });

    describe('a redirect return in the real address', () => {
        it('is confirmed once, and a remount (a reload) does not send it again', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            visit('?coupon_code=SAVE&payment_acceptor_id=paya_123&redirectResult=res_1', '#plans');

            const first = await mountComponent();
            expect(first.emitted('payment-success')).toHaveLength(1);
            first.unmount();
            const second = await mountComponent();

            expect(mockGetPaymentDetails).toHaveBeenCalledTimes(1);
            expect(second.emitted('payment-success')).toBeUndefined();
            expect(window.location.search).toBe('?coupon_code=SAVE');
            expect(window.location.hash).toBe('#plans');
        });

        it('keeps unrelated parameters, repeated keys and their values intact', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            visit(
                '?tag=a&tag=b&next=%2Fdone%3Fx%3D1&payment_acceptor_id=paya_123&redirectResult=res_1',
            );

            await mountComponent();

            const params = new URLSearchParams(window.location.search);
            expect(params.getAll('tag')).toEqual(['a', 'b']);
            expect(params.get('next')).toBe('/done?x=1');
            expect(params.has('redirectResult')).toBe(false);
            expect(params.has('payment_acceptor_id')).toBe(false);
        });

        it('sends the same result again exactly once per "Try again" until it is answered', async () => {
            visit('?payment_acceptor_id=paya_123&redirectResult=res_1');
            mockGetPaymentDetails
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce({ payment_status: 'SUCCESS' });

            const wrapper = await mountComponent();
            expect(mockAdyenCheckout).not.toHaveBeenCalled();
            await retry(wrapper);
            expect(mockGetPaymentDetails).toHaveBeenCalledTimes(2);
            expect(mockAdyenCheckout).not.toHaveBeenCalled();
            await retry(wrapper);

            expect(mockGetPaymentDetails).toHaveBeenCalledTimes(3);
            for (const [call] of mockGetPaymentDetails.mock.calls) {
                expect(call).toMatchObject({
                    paymentAcceptorId: 'paya_123',
                    adyen: { details: { redirectResult: 'res_1' } },
                });
            }
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
            expect(mockAdyenCheckout).not.toHaveBeenCalled();
        });

        it('only the form of the named acceptor confirms it, with several on the page', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            visit('?payment_acceptor_id=paya_2&redirectResult=res_1');

            const one = await mountComponent({ paymentMethodOptionResponseEntry: entry('paya_1') });
            const two = await mountComponent({ paymentMethodOptionResponseEntry: entry('paya_2') });
            const three = await mountComponent({
                paymentMethodOptionResponseEntry: entry('paya_3'),
            });

            expect(mockGetPaymentDetails).toHaveBeenCalledTimes(1);
            expect(mockGetPaymentDetails).toHaveBeenCalledWith(
                expect.objectContaining({ paymentAcceptorId: 'paya_2' }),
            );
            expect(two.emitted('payment-success')).toHaveLength(1);
            for (const other of [one, three]) {
                expect(other.emitted('payment-success')).toBeUndefined();
                expect(other.emitted('payment-failed')).toBeUndefined();
            }
        });

        it('leaves a return no mounted form names in place', async () => {
            visit('?payment_acceptor_id=paya_9&redirectResult=res_1');

            await mountComponent({ paymentMethodOptionResponseEntry: entry('paya_1') });

            expect(window.location.search).toContain('redirectResult=res_1');
            expect(mockGetPaymentDetails).not.toHaveBeenCalled();
        });

        it.each([
            ['a malformed percent sequence', 'redirectResult=%E0%A4%A'],
            ['unicode', `redirectResult=${encodeURIComponent('résultat✓')}`],
            ['a space', 'redirectResult=a%20b'],
            ['a plus, which the address reads as a space', 'redirectResult=a+b'],
            ['a control character', 'redirectResult=a%00b'],
            ['a huge value', `redirectResult=${'A'.repeat(100_000)}`],
            ['an empty value', 'redirectResult='],
        ])('neither crashes nor reaches the API on %s', async (_, query) => {
            visit(`?payment_acceptor_id=paya_123&${query}`);

            const wrapper = await mountComponent();

            expect(mockGetPaymentDetails).not.toHaveBeenCalled();
            expect(failedCodes(wrapper).every((c) => c === 'PAYMENT_OUTCOME_UNCONFIRMED')).toBe(
                true,
            );
        });

        // The brief: hostile values such as `%` never reach the API. A lone `%` survives
        // URLSearchParams as itself and passes the printable-ASCII shape check, as does markup.
        it.fails.each([
            ['a lone percent sign', 'redirectResult=%'],
            ['markup', `redirectResult=${encodeURIComponent('<script>alert(1)</script>')}`],
        ])('does not send %s to the API', async (_, query) => {
            visit(`?payment_acceptor_id=paya_123&${query}`);

            await mountComponent();

            expect(mockGetPaymentDetails).not.toHaveBeenCalled();
        });

        it.each([
            ['a wrong acceptor', '?payment_acceptor_id=paya_other&redirectResult=res_1'],
            [
                'a look-alike acceptor in unicode',
                `?payment_acceptor_id=${encodeURIComponent('payа_123')}&redirectResult=res_1`,
            ],
            ['a percent acceptor', '?payment_acceptor_id=%&redirectResult=res_1'],
        ])('ignores %s', async (_, search) => {
            visit(search);

            const wrapper = await mountComponent();

            expect(mockGetPaymentDetails).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toBeUndefined();
            expect(mockAdyenCheckout).toHaveBeenCalledTimes(1);
        });

        it('confirms the first of repeated redirect results only, once', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            visit('?payment_acceptor_id=paya_123&redirectResult=res_1&redirectResult=res_2');

            await mountComponent();
            await mountComponent();

            expect(mockGetPaymentDetails).toHaveBeenCalledTimes(1);
            expect(window.location.search).toBe('');
        });

        // onMounted promises the drop-in waits for the returned payment; an options change while
        // it is being confirmed builds the drop-in anyway. The same happens on the base.
        it.fails(
            'offers no drop-in while the returned payment is still being confirmed',
            async () => {
                mockGetPaymentDetails.mockReturnValue(new Promise(() => {}));
                visit('?payment_acceptor_id=paya_123&redirectResult=res_1');

                const wrapper = mount(PaymentIntegrationFormAdyen, { props: mockProps });
                await flushPromises();
                await wrapper.setProps({
                    paymentMethodOptionResponseEntry: {
                        ...entry('paya_123'),
                        options: [{ name: 'iDEAL' }],
                    } as never,
                });
                await flushPromises();

                expect(mockDropInMount).not.toHaveBeenCalled();
            },
        );
    });

    describe('mounting', () => {
        it('stops quietly when unmounted while a returned payment is being confirmed', async () => {
            let answer: (value: unknown) => void = () => {};
            mockGetPaymentDetails.mockReturnValue(new Promise((resolve) => (answer = resolve)));
            visit('?payment_acceptor_id=paya_123&redirectResult=res_1');

            const wrapper = mount(PaymentIntegrationFormAdyen, { props: mockProps });
            await flushPromises();
            wrapper.unmount();
            answer({ payment_status: 'REFUSED' });
            await flushPromises();

            expect(mockAdyenCheckout).not.toHaveBeenCalled();
            expect(mockDropInMount).not.toHaveBeenCalled();
        });

        it('leaves one drop-in after rapid option changes overtake each other', async () => {
            const releases: (() => void)[] = [];
            mockAdyenCheckout.mockImplementation(
                (config: unknown) =>
                    new Promise((resolve) => releases.push(() => resolve({ config }))),
            );
            const wrapper = mount(PaymentIntegrationFormAdyen, { props: mockProps });
            await flushPromises();
            for (const id of ['paya_a', 'paya_b', 'paya_c', 'paya_d']) {
                await wrapper.setProps({ paymentMethodOptionResponseEntry: entry(id) });
                await flushPromises();
            }
            // Released latest first, oldest last.
            releases.reverse().forEach((release) => release());
            await flushPromises();

            expect(releases).toHaveLength(5);
            expect(mockDropInMount).toHaveBeenCalledTimes(1);
            mockAdyenCheckout.mockReset();
        });

        it('puts each style in once when two forms share a shadow root', async () => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            const shadowRoot = host.attachShadow({ mode: 'open' });
            const targets = [document.createElement('div'), document.createElement('div')];
            targets.forEach((t) => shadowRoot.appendChild(t));

            const wrappers = [
                mount(PaymentIntegrationFormAdyen, {
                    props: { ...mockProps, paymentMethodOptionResponseEntry: entry('paya_1') },
                    attachTo: targets[0],
                }),
                mount(PaymentIntegrationFormAdyen, {
                    props: {
                        ...mockProps,
                        variant: 'TOKENIZE',
                        paymentMethodOptionResponseEntry: entry('paya_2'),
                    },
                    attachTo: targets[1],
                }),
            ];
            await flushPromises();
            await wrappers[0]!.setProps({ paymentMethodOptionResponseEntry: entry('paya_3') });
            await flushPromises();

            const names = [...shadowRoot.querySelectorAll('style')].map((s) =>
                s.getAttribute('data-sv-adyen-styles'),
            );
            expect(names.sort()).toEqual(['authorize', 'overrides', 'sdk']);

            wrappers.forEach((w) => w.unmount());
            host.remove();
        });
    });

    describe('one payment at a time', () => {
        it('lets a payment through again after a validation that threw', async () => {
            const validateOnSubmit = vi
                .fn()
                .mockRejectedValueOnce(new Error('validation threw'))
                .mockResolvedValueOnce(true);
            mockAuthorizePayment.mockReturnValue(new Promise(() => {}));
            await mountComponent({ validateOnSubmit });

            await submitThroughDropIn();
            await submitThroughDropIn();

            expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
        });

        it('holds a second Enter and the button while validation of the first is running', async () => {
            let validate: (ok: boolean) => void = () => {};
            const validateOnSubmit = vi.fn(
                () => new Promise<boolean>((resolve) => (validate = resolve)),
            );
            mockAuthorizePayment.mockReturnValue(new Promise(() => {}));
            const wrapper = await mountComponent({ validateOnSubmit });

            void captured.checkoutConfig?.onSubmit?.(submitState, {}, newActions());
            void captured.checkoutConfig?.onSubmit?.(submitState, {}, newActions());
            (wrapper.vm as unknown as { submit: () => void }).submit();
            validate(true);
            await flushPromises();

            expect(validateOnSubmit).toHaveBeenCalledTimes(1);
            expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
            expect(adyen.dropIn.submit).not.toHaveBeenCalled();
            expect(wrapper.emitted('submitting')).toHaveLength(1);
        });

        it('lets a payment through again after the API turned the last one down', async () => {
            mockAuthorizePayment
                .mockRejectedValueOnce(new ApiError({ statusCode: 422 }))
                .mockReturnValueOnce(new Promise(() => {}));
            await mountComponent();

            const first = await submitThroughDropIn();
            expect(first.resolve).toHaveBeenCalledWith({ resultCode: 'Error' });
            captured.checkoutConfig?.onPaymentFailed?.({ resultCode: 'Error' });
            await submitThroughDropIn();

            expect(mockAuthorizePayment).toHaveBeenCalledTimes(2);
        });

        it('lets a tokenize through again after one refused for a missing customer', async () => {
            const wrapper = await mountComponent({ variant: 'TOKENIZE', customerId: undefined });

            await submitThroughDropIn();
            await submitThroughDropIn();

            expect(failedCodes(wrapper)).toEqual(['TOKENIZE_FAILED', 'TOKENIZE_FAILED']);
        });
    });
});
