import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import type { Invoice, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import PayInvoice from './PayInvoice.vue';
import {
    createPaymentMethodOptionEntry,
    createPaymentMethodOptionsResponseWithoutOptions,
} from '@/test-utils/paymentMethodOptionsFixture';

// ─── Adyen SDK mocks ──────────────────────────────────────────────────────────

const { mockAdyenCheckout, MockDropIn } = vi.hoisted(() => {
    const mockDropInInstance = {
        unmount: vi.fn(),
        submit: vi.fn(),
        handleAction: vi.fn(),
    };
    const MockDropIn = vi.fn().mockImplementation((_checkoutInstance, _config) => ({
        mount: vi.fn().mockReturnValue(mockDropInInstance),
    }));
    const mockAdyenCheckout = vi.fn().mockImplementation((_config) => Promise.resolve({}));
    return { mockAdyenCheckout, MockDropIn };
});

vi.mock('@adyen/adyen-web', () => ({
    AdyenCheckout: mockAdyenCheckout,
    Dropin: MockDropIn,
    Card: vi.fn(),
    Bancontact: vi.fn(),
    Ach: vi.fn(),
    AmazonPay: vi.fn(),
    ApplePay: vi.fn(),
    BcmcMobile: vi.fn(),
    BacsDirectDebit: vi.fn(),
    CashAppPay: vi.fn(),
    EPS: vi.fn(),
    GooglePay: vi.fn(),
    Klarna: vi.fn(),
    PayByBank: vi.fn(),
    PayPal: vi.fn(),
    SepaDirectDebit: vi.fn(),
    Trustly: vi.fn(),
    Twint: vi.fn(),
    PayByBankUS: vi.fn(),
    Redirect: vi.fn(),
}));

vi.mock('@adyen/adyen-web/styles/adyen.css?inline', () => ({ default: '' }));

// ─── Service mocks ────────────────────────────────────────────────────────────

const mockAuthorizePayment = vi.fn();
const mockGetPaymentDetails = vi.fn();
const mockTokenizePaymentMethod = vi.fn();

vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({
        authorizePayment: mockAuthorizePayment,
        getPaymentDetails: mockGetPaymentDetails,
    }),
}));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({
        tokenizePaymentMethod: mockTokenizePaymentMethod,
    }),
}));

// ─── Provider mocks ───────────────────────────────────────────────────────────

const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    capture: vi.fn(),
};

vi.mock('@/components/providers', () => ({
    useLogger: () => mockLogger,
}));

vi.mock(
    '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature',
    () => ({ useExperimentalFeature: () => ref(null) }),
);

// ─── UI library mock ──────────────────────────────────────────────────────────

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    const { mockUseIntl } = await import('@/test-utils/useIntlMock');
    return {
        ...actual,
        useIntl: () => ({ ...mockUseIntl(), locale: 'en-US' }),
        formatAmount: (amount: { currency: string; quantity: string }) =>
            `${amount.currency} ${amount.quantity}`,
        InvoiceHeader: defineComponent({
            name: 'InvoiceHeader',
            template: '<div data-testid="invoice-header" />',
        }),
        InvoiceSummary: defineComponent({
            name: 'InvoiceSummary',
            template: '<div data-testid="invoice-summary" />',
        }),
    };
});

// ─── Test fixtures ────────────────────────────────────────────────────────────

const mockPaymentMethodOptions: PaymentMethodOptionsResponse = [
    createPaymentMethodOptionEntry({ paymentAcceptorId: 'pa_123' }),
];

const paymentMethodOptionsWithoutOptions = createPaymentMethodOptionsResponseWithoutOptions({
    paymentAcceptorId: 'pa_123',
});

const mockInvoice = {
    id: 'inv_123',
    invoice_number: 'INV-001',
    billing_entity: { legal_name: 'AIAIAI B.V.' },
    customer: {
        id: 'cus_123',
        email: 'customer@example.com',
        reference: 'CUS-001',
        type: 'INDIVIDUAL',
        individual: { registered_address: { country: 'NL' } },
    },
    open_invoice_amount: { currency: 'EUR', quantity: '99.00' },
    tax_summary: {
        total_amount: { currency: 'EUR', quantity: '99.00' },
        base_amount: { currency: 'EUR', quantity: '81.82' },
        tax_amount: { currency: 'EUR', quantity: '17.18' },
        country_code: 'NL',
    },
    paid: false,
    status: 'OPEN',
} as unknown as Invoice;

const amount = { currency: 'EUR', quantity: '99.00' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
    await import('@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue');
});

async function waitForAdyenMount() {
    await flushPromises();
    await nextTick();
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Drives the drop-in's submit the way Adyen does once the customer has pressed pay. */
async function submitThroughDropIn() {
    const [checkoutConfig] = mockAdyenCheckout.mock.calls[0];

    await checkoutConfig.onSubmit(
        {
            data: {
                paymentMethod: { type: 'scheme' },
                riskData: {},
                browserInfo: {},
            },
        },
        {},
        { resolve: vi.fn(), reject: vi.fn() },
    );
    await flushPromises();
}

const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(PayInvoice, {
        props: {
            isLoading: false,
            invoice: mockInvoice,
            amount,
            countryCode: 'NL',
            paymentMethodOptions: mockPaymentMethodOptions,
            configuration: { invoiceId: 'inv_123' },
            handleSuccessRedirect: vi.fn(),
            ...props,
        },
        global: { stubs: { teleport: true } },
    });

const challenge = {
    status: 'ACTION_REQUIRED',
    action: {
        payment_gateway_variant: 'ADYEN',
        method: 'GET',
        url: 'https://adyen.test/3ds',
        data: {},
        adyen: {
            result_code: 'ChallengeShopper',
            action_type: 'threeDS2',
            payment_method_type: 'scheme',
        },
    },
};

type Handlers = {
    onSubmit: (state: unknown, component: unknown, actions: unknown) => Promise<void> | void;
    onPaymentFailed: (data: unknown) => void;
    onError: (data: unknown) => void;
};

const handlersOf = (index: number) => mockAdyenCheckout.mock.calls[index]![0] as Handlers;

async function submitThrough(index: number) {
    await handlersOf(index).onSubmit(
        { data: { paymentMethod: { type: 'scheme' }, riskData: {}, browserInfo: {} } },
        {},
        { resolve: vi.fn(), reject: vi.fn() },
    );
    await flushPromises();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PayInvoice', () => {
    beforeEach(async () => {
        await waitForAdyenMount();

        vi.clearAllMocks();
    });

    it('shows only skeletons while loading', () => {
        const wrapper = mountComponent({ isLoading: true, invoice: undefined });

        expect(wrapper.find('[data-testid="invoice-summary"]').exists()).toBe(false);
        expect(wrapper.text()).toBe('');
    });

    it('shows a success card when the invoice is already paid', () => {
        const paidInvoice = { ...mockInvoice, paid: true } as unknown as Invoice;
        const wrapper = mountComponent({ invoice: paidInvoice });

        expect(wrapper.text()).toContain('Thank you for your payment!');
        expect(wrapper.text()).toContain('EUR 99.00');
    });

    it('shows an error card when the error prop is set', () => {
        const wrapper = mountComponent({ error: new Error('Network error') });

        expect(wrapper.text()).toContain('Something went wrong');
    });

    it('mounts the Adyen drop-in when all required data is available', async () => {
        mountComponent();
        await waitForAdyenMount();

        expect(mockAdyenCheckout).toHaveBeenCalledOnce();
        expect(MockDropIn).toHaveBeenCalledOnce();
    });

    it('does not mount the Adyen drop-in when the invoice is missing', async () => {
        mountComponent({ invoice: undefined });
        await waitForAdyenMount();

        expect(MockDropIn).not.toHaveBeenCalled();
    });

    it('does not mount the Adyen drop-in when countryCode is missing', async () => {
        mountComponent({ countryCode: undefined });
        await waitForAdyenMount();

        expect(MockDropIn).not.toHaveBeenCalled();
    });

    it('renders the invoice summary when an invoice is provided', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('[data-testid="invoice-summary"]').exists()).toBe(true);
    });

    it('renders the pay button as disabled when no payment method is selected', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('button').attributes('disabled')).toBeDefined();
    });

    it('enables the pay button after the drop-in emits a payment method selection', async () => {
        const wrapper = mountComponent();
        await waitForAdyenMount();

        const [, dropInConfig] = MockDropIn.mock.calls[0];
        dropInConfig.onSelect({ props: { type: 'scheme' } });
        await nextTick();

        expect(wrapper.find('button').attributes('disabled')).toBeUndefined();
    });

    it('shows the unavailable state for an entry whose integration names no gateway', async () => {
        const optionsWithNoVariant = [
            {
                ...mockPaymentMethodOptions[0],
                integration: {
                    ...mockPaymentMethodOptions[0].integration,
                    payment_gateway: undefined,
                },
            },
        ];
        const wrapper = mountComponent({ paymentMethodOptions: optionsWithNoVariant });
        await waitForAdyenMount();

        expect(wrapper.find('[data-testid="payment-methods-unavailable"]').exists()).toBe(true);
        expect(MockDropIn).not.toHaveBeenCalled();
    });

    describe('when the options entry arrives without its options array', () => {
        const mountWithoutOptions = (props: Record<string, unknown> = {}) =>
            mountComponent({ paymentMethodOptions: paymentMethodOptionsWithoutOptions, ...props });

        it('never mounts a drop-in that would have no payment methods in it', async () => {
            mountWithoutOptions();
            await waitForAdyenMount();

            expect(MockDropIn).not.toHaveBeenCalled();
            expect(mockAdyenCheckout).not.toHaveBeenCalled();
        });

        it('says the invoice cannot be paid online instead of leaving the region blank', async () => {
            const wrapper = mountWithoutOptions();
            await waitForAdyenMount();

            expect(wrapper.find('[data-testid="payment-methods-unavailable"]').exists()).toBe(true);
            expect(wrapper.text()).toContain('This invoice cannot be paid online');
            expect(wrapper.text()).not.toContain('Payment methods');
        });

        it('names the seller and offers the invoice download, and never a retry', async () => {
            const wrapper = mountWithoutOptions({ downloadService: vi.fn() });
            await waitForAdyenMount();

            expect(wrapper.text()).toContain('AIAIAI B.V.');
            expect(wrapper.text()).toContain('Download invoice');
            expect(wrapper.text()).not.toContain('Try again');
        });

        it('downloads the invoice when that is pressed', async () => {
            const downloadService = vi.fn().mockResolvedValue(undefined);
            const wrapper = mountWithoutOptions({ downloadService });
            await waitForAdyenMount();

            await wrapper
                .get('[data-testid="payment-methods-unavailable"] button')
                .trigger('click');

            expect(downloadService).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'inv_123', invoice_number: 'INV-001' }),
            );
        });

        it('drops the pay button, which could only ever have been dead', async () => {
            const wrapper = mountWithoutOptions();
            await waitForAdyenMount();

            expect(wrapper.findComponent({ name: 'PayButton' }).exists()).toBe(false);
        });

        it('reports it grouped by payment acceptor, with the ids needed to chase it', async () => {
            mountWithoutOptions();
            await waitForAdyenMount();

            expect(mockLogger.error).toHaveBeenCalledWith(
                'NO_PAYMENT_METHODS_AVAILABLE',
                expect.any(String),
                expect.objectContaining({
                    fingerprint: ['NO_PAYMENT_METHODS_AVAILABLE', 'pa_123'],
                    paymentAcceptorIds: ['pa_123'],
                    integrationIds: ['int_123'],
                    invoiceId: 'inv_123',
                }),
            );
        });
    });

    it('shows the loading skeleton rather than the unavailable state while options are still out', async () => {
        const wrapper = mountComponent({
            isLoading: true,
            paymentMethodOptions: [],
        });
        await waitForAdyenMount();

        expect(wrapper.find('[data-testid="payment-methods-unavailable"]').exists()).toBe(false);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    describe('storing the payment method', () => {
        const STORE_CHECKBOX = '#pay-invoice-store-payment-method';

        beforeEach(() => {
            mockAuthorizePayment.mockResolvedValue({
                status: 'SUCCESS',
                payment: { result: 'AUTHORIZED' },
            });
        });

        it('offers to save the payment method, ticked, alongside the drop-in', async () => {
            const wrapper = mountComponent();
            await waitForAdyenMount();

            expect(wrapper.text()).toContain('Save this payment method for future payments');
            expect((wrapper.get(STORE_CHECKBOX).element as HTMLInputElement).checked).toBe(true);
        });

        it('pays and stores the method in the one call while the box stays ticked', async () => {
            mountComponent();
            await waitForAdyenMount();

            await submitThroughDropIn();

            expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
            expect(mockAuthorizePayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    adyen: expect.objectContaining({ store_payment_method: true }),
                }),
            );
        });

        it('pays without storing the method once the box is unticked', async () => {
            const wrapper = mountComponent();
            await waitForAdyenMount();

            await wrapper.get(STORE_CHECKBOX).setValue(false);
            await submitThroughDropIn();

            expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
            expect(mockAuthorizePayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    adyen: expect.objectContaining({ store_payment_method: false }),
                }),
            );
        });
    });

    it('calls onPaymentSuccess when the Adyen drop-in completes a payment', async () => {
        const onPaymentSuccess = vi.fn();
        mountComponent({ configuration: { invoiceId: 'inv_123', onPaymentSuccess } });
        await waitForAdyenMount();

        const [checkoutConfig] = mockAdyenCheckout.mock.calls[0];
        checkoutConfig.onPaymentCompleted({}, { unmount: vi.fn() });
        await nextTick();

        expect(onPaymentSuccess).toHaveBeenCalledOnce();
    });

    // A redirect return emitted success without the screen noticing, so "Pay" stayed enabled on an
    // invoice the customer had just paid.
    it('stops offering payment and reloads the invoice once a payment succeeds', async () => {
        const refresh = vi.fn().mockResolvedValue(undefined);
        const wrapper = mountComponent({ refresh });
        await waitForAdyenMount();

        const [checkoutConfig] = mockAdyenCheckout.mock.calls[0];
        checkoutConfig.onPaymentCompleted({}, { unmount: vi.fn() });
        await flushPromises();

        expect(refresh).toHaveBeenCalledOnce();
        expect(wrapper.text()).toContain('Thank you for your payment!');
        expect(wrapper.findComponent({ name: 'PayButton' }).exists()).toBe(false);
    });

    it('keeps the pay button off while the outcome of a payment is unconfirmed', async () => {
        mockAuthorizePayment.mockRejectedValue(new TypeError('Failed to fetch'));
        const wrapper = mountComponent();
        await waitForAdyenMount();

        const [, dropInConfig] = MockDropIn.mock.calls[0];
        dropInConfig.onSelect({ props: { type: 'scheme' } });
        await submitThroughDropIn();

        expect(wrapper.text()).toContain('Payment not confirmed yet');
        expect(
            wrapper.findComponent({ name: 'PayButton' }).find('button').attributes('disabled'),
        ).toBeDefined();
    });

    describe('returning from an Adyen redirect', () => {
        beforeEach(() => {
            window.history.replaceState(
                {},
                '',
                '/?redirectResult=res_1&payment_acceptor_id=pa_123',
            );
        });

        afterEach(() => {
            window.history.replaceState({}, '', '/');
        });

        it('settles a successful return once and stops offering payment', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            const onPaymentSuccess = vi.fn();
            const refresh = vi.fn().mockResolvedValue(undefined);

            const wrapper = mountComponent({
                refresh,
                configuration: { invoiceId: 'inv_123', onPaymentSuccess },
            });
            await waitForAdyenMount();

            expect(onPaymentSuccess).toHaveBeenCalledOnce();
            expect(refresh).toHaveBeenCalledOnce();
            expect(MockDropIn).not.toHaveBeenCalled();
            expect(wrapper.text()).toContain('Thank you for your payment!');
            expect(wrapper.findComponent({ name: 'PayButton' }).exists()).toBe(false);
        });

        it('keeps reading as paid when the reloaded invoice has not caught up yet', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'SUCCESS' });
            const wrapper = mountComponent({ refresh: vi.fn().mockResolvedValue(undefined) });
            await waitForAdyenMount();

            await wrapper.setProps({ invoice: { ...mockInvoice } });
            await flushPromises();

            expect(wrapper.text()).toContain('Thank you for your payment!');
            expect(wrapper.findComponent({ name: 'PayButton' }).exists()).toBe(false);
        });

        // PayInvoice says nothing itself on a failure; the form's card is all the customer gets.
        it('tells the customer a refused return did not go through', async () => {
            mockGetPaymentDetails.mockResolvedValue({ payment_status: 'REFUSED' });
            const wrapper = mountComponent();
            await waitForAdyenMount();

            expect(MockDropIn).toHaveBeenCalledOnce();
            expect(wrapper.text()).toContain('Payment failed');
        });
    });

    // Enter in a card field pays without the button, which then stayed live for a second payment.
    it('holds the pay button while a payment the drop-in started is on its way', async () => {
        mockAuthorizePayment.mockReturnValue(new Promise(() => {}));
        const wrapper = mountComponent();
        await waitForAdyenMount();

        const [, dropInConfig] = MockDropIn.mock.calls[0];
        dropInConfig.onSelect({ props: { type: 'scheme' } });
        await submitThroughDropIn();

        expect(
            wrapper.findComponent({ name: 'PayButton' }).find('button').attributes('disabled'),
        ).toBeDefined();
    });

    // Adyen draws a 3DS challenge inside the form; held, the customer could not click it.
    it('leaves the form within reach while the customer completes a challenge', async () => {
        mockAuthorizePayment.mockResolvedValue({
            status: 'ACTION_REQUIRED',
            action: {
                payment_gateway_variant: 'ADYEN',
                method: 'GET',
                url: 'https://adyen.test/3ds',
                data: {},
                adyen: {
                    result_code: 'ChallengeShopper',
                    action_type: 'threeDS2',
                    payment_method_type: 'scheme',
                },
            },
        });
        const wrapper = mountComponent();
        await waitForAdyenMount();

        const [, dropInConfig] = MockDropIn.mock.calls[0];
        dropInConfig.onSelect({ props: { type: 'scheme' } });
        await wrapper.findComponent({ name: 'PayButton' }).find('button').trigger('click');
        await submitThroughDropIn();

        expect(wrapper.find('.pointer-events-none').exists()).toBe(false);
        expect(
            wrapper.findComponent({ name: 'PayButton' }).find('button').attributes('disabled'),
        ).toBeDefined();
    });
});

describe('PayInvoice around a 3DS challenge', () => {
    const isHeld = (wrapper: ReturnType<typeof mountComponent>) =>
        wrapper.find('.pointer-events-none').exists();
    const payButton = (wrapper: ReturnType<typeof mountComponent>) =>
        wrapper.findComponent({ name: 'PayButton' }).find('button');

    async function intoChallenge() {
        mockAuthorizePayment.mockResolvedValueOnce(challenge);
        const wrapper = mountComponent();
        await waitForAdyenMount();
        const [, dropInConfig] = MockDropIn.mock.calls[0];
        dropInConfig.onSelect({ props: { type: 'scheme' } });
        await payButton(wrapper).trigger('click');
        await submitThrough(0);
        expect(isHeld(wrapper)).toBe(false);
        expect(payButton(wrapper).attributes('disabled')).toBeDefined();
        return wrapper;
    }

    beforeEach(async () => {
        await waitForAdyenMount();
        vi.clearAllMocks();
        // A form per acceptor builds its own drop-in, which an arrow implementation cannot be.
        // `setStatus` is what a submit turned down by another form calls.
        MockDropIn.mockImplementation(function Dropin() {
            const dropIn = { unmount: vi.fn(), submit: vi.fn(), setStatus: vi.fn() };
            return { mount: vi.fn().mockReturnValue(dropIn) };
        });
    });

    it.each([
        ['a refused challenge', () => handlersOf(0).onPaymentFailed({ resultCode: 'Refused' })],
        ['a closed wallet sheet', () => handlersOf(0).onError({ name: 'CANCEL' })],
    ])('holds the form again for the next payment after %s', async (_, end) => {
        const wrapper = await intoChallenge();

        end();
        await flushPromises();
        expect(isHeld(wrapper)).toBe(false);
        expect(payButton(wrapper).attributes('disabled')).toBeUndefined();

        mockAuthorizePayment.mockReturnValueOnce(new Promise(() => {}));
        await payButton(wrapper).trigger('click');
        await submitThrough(0);

        expect(isHeld(wrapper)).toBe(true);
    });

    it('holds nothing open after an unconfirmed challenge, and leaves pay off', async () => {
        mockGetPaymentDetails.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const wrapper = await intoChallenge();
        const { onAdditionalDetails } = handlersOf(0) as unknown as {
            onAdditionalDetails: (s: unknown, c: unknown, a: unknown) => void;
        };

        onAdditionalDetails(
            { data: { details: { threeDSResult: 'x' } } },
            {},
            { resolve: vi.fn() },
        );
        await flushPromises();

        expect(isHeld(wrapper)).toBe(false);
        expect(payButton(wrapper).attributes('disabled')).toBeDefined();
    });

    it('takes no second payment from Enter in the same drop-in during the challenge', async () => {
        await intoChallenge();

        await submitThrough(0);

        expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
    });

    // Released for the challenge, the wrapper also releases every other gateway form inside it.
    // A second Adyen acceptor's own submit (Enter in its card fields, its PayPal button) passes its
    // own in-flight guard, and the screen's validation does not look at pending.
    it('takes no payment from another acceptor while a challenge is up', async () => {
        mockAuthorizePayment.mockResolvedValueOnce(challenge);
        mockAuthorizePayment.mockReturnValueOnce(new Promise(() => {}));
        const acceptor = (id: string) =>
            createPaymentMethodOptionEntry({ paymentAcceptorId: id, integrationId: `int_${id}` });
        const wrapper = mountComponent({ paymentMethodOptions: [acceptor('pa_1')] });
        await waitForAdyenMount();
        // Added once the first is built: two forms importing the mocked SDK at once never settle.
        await wrapper.setProps({ paymentMethodOptions: [acceptor('pa_1'), acceptor('pa_2')] });
        await waitForAdyenMount();
        expect(mockAdyenCheckout).toHaveBeenCalledTimes(2);
        const [, dropInConfig] = MockDropIn.mock.calls[0];
        dropInConfig.onSelect({ props: { type: 'scheme' } });
        await payButton(wrapper).trigger('click');
        const [first] = mockAdyenCheckout.mock.calls.map(([config]) => config as Handlers);
        await first!.onSubmit(
            { data: { paymentMethod: { type: 'scheme' }, riskData: {}, browserInfo: {} } },
            {},
            { resolve: vi.fn(), reject: vi.fn() },
        );
        await flushPromises();
        expect(isHeld(wrapper)).toBe(false);

        await submitThrough(1);

        expect(mockAuthorizePayment).toHaveBeenCalledTimes(1);
    });
});
