import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import type { Invoice, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import PayInvoice from './PayInvoice.vue';

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

const mockLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn(), capture: vi.fn() };

vi.mock('@/components/providers', () => ({
    useLogger: () => mockLogger,
}));

vi.mock(
    '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature',
    () => ({ useExperimentalFeature: () => ref(null) }),
);

// ─── UI library mock ──────────────────────────────────────────────────────────

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>(
        '@solvimon/solvimon-ui',
    );
    return {
        ...actual,
        useIntl: () => ({
            $t: (message: { defaultMessage: string }) => message.defaultMessage,
            locale: 'en-US',
        }),
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
    {
        payment_acceptor: {
            id: 'pa_123',
            object_type: 'PAYMENT_ACCEPTOR',
            name: 'Test Acceptor',
            reference: 'test-ref',
            status: 'ACTIVE',
        } as PaymentMethodOptionsResponse[0]['payment_acceptor'],
        integration: {
            id: 'int_123',
            object_type: 'INTEGRATION',
            reference: 'int-ref',
            name: 'Test Integration',
            description: '',
            status: 'ACTIVE',
            type: 'PAYMENT_GATEWAY',
            payment_gateway: {
                variant: 'ADYEN',
                adyen: {
                    company_account: 'TestCompany',
                    environment: 'TEST',
                    merchant_accounts: ['TestMerchant'],
                    public_key: 'test-client-key',
                    live_prefix: '',
                },
            },
        } as PaymentMethodOptionsResponse[0]['integration'],
        options: [],
    },
];

const mockInvoice = {
    id: 'inv_123',
    invoice_number: 'INV-001',
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

async function waitForAdyenMount() {
    await nextTick();
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PayInvoice', () => {
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

    beforeEach(() => {
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

    it('shows "Select a payment method" error when submitted without selecting a payment method', async () => {
        const optionsWithNoVariant = [
            {
                ...mockPaymentMethodOptions[0],
                integration: { ...mockPaymentMethodOptions[0].integration, payment_gateway: undefined },
            },
        ];
        const wrapper = mountComponent({ paymentMethodOptions: optionsWithNoVariant });
        await waitForAdyenMount();

        await wrapper.findComponent({ name: 'PaymentIntegrationForm' }).vm.submit();
        await nextTick();

        expect(wrapper.text()).toContain('Select a payment method');
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
});
