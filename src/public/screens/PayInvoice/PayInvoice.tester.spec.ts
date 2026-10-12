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
        fetchInitial: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue([]),
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

// ─── DD-3538 round 2, from the tester ─────────────────────────────────────────

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

describe('PayInvoice (DD-3538 round 2 tester)', () => {
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
        // `setStatus` is what a turned-down submit calls, now that another form can turn it down.
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
    // A second Adyen acceptor's own submit (Enter in its card fields, its PayPal button) has its
    // own in-flight guard and the screen's validation does not look at pending, so it paid again.
    // Keyboard could already reach it while held; the release made it reachable by pointer too.
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
