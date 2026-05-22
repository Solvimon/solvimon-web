import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, ref, h } from 'vue';
import type { Invoice, Payment } from '@solvimon/solvimon-types';
import InvoiceEntry from './Invoice.entry.vue';
import type { SolvimonInvoiceEntryProps } from './Invoice.entry.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const { mockUseInvoice, mockUsePayments, mockUseLoadInitialData, mockDownloadInvoicePdf, mockInvoiceGet, mockPaymentsGet } =
    vi.hoisted(() => ({
        mockUseInvoice: vi.fn(),
        mockUsePayments: vi.fn(),
        mockUseLoadInitialData: vi.fn(),
        mockDownloadInvoicePdf: vi.fn(),
        mockInvoiceGet: vi.fn(),
        mockPaymentsGet: vi.fn(),
    }));

vi.mock('./Invoice.entry.ce', () => ({
    COMPONENT_NAME: 'solvimon-invoice',
    SolvimonInvoice: {},
    defineSolvimonInvoice: () => {},
}));

vi.mock('@/composables/useInvoice', () => ({ useInvoice: mockUseInvoice }));
vi.mock('@/composables/usePayments', () => ({ usePayments: mockUsePayments }));
vi.mock('@/composables/useLoadInitialData', () => ({ useLoadInitialData: mockUseLoadInitialData }));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    // Stub library bundle components that require deep provider chains or complete invoice data
    return createSolvimonUiMock({
        InvoiceHeader: defineComponent({ template: '<div />' }),
        InvoiceSummary: defineComponent({ template: '<div />' }),
        CustomerBillingInformation: defineComponent({
            props: ['title', 'customer'],
            setup(props) {
                return () => h('div', props.title);
            },
        }),
        PaymentMethod: defineComponent({ template: '<div />' }),
    });
});

describe('Invoice entry component', () => {
    const invoiceId = 'inv_123' as Invoice['id'];

    const invoice = {
        id: invoiceId,
        invoice_number: 'INV-001',
        invoice_date: '2024-01-15T00:00:00Z',
        customer: {
            id: 'cus_123',
            timezone: 'Europe/Amsterdam',
        },
        invoice_amount_including_tax: {
            currency: 'EUR',
            quantity: '1000',
        },
    } as unknown as Invoice;

    const payments = [
        {
            id: 'pay_123',
            result: 'AUTHORIZED',
            created_at: '2024-01-15T10:00:00Z',
            payment_method_details: { type: 'CARD' },
        },
    ] as unknown as Payment[];

    const defaultConfiguration: SolvimonInvoiceEntryProps['configuration'] = {
        invoiceId,
        enableDownloadButton: true,
        enableCustomerBillingInformation: true,
        enablePaymentAttempts: true,
    };

    const defaultProps: SolvimonInvoiceEntryProps = {
        environment: 'TEST',
        locale: 'en-US',
        portalObject: createTestPortalObject(),
        configuration: defaultConfiguration,
    };

    const mountComponent = async ({
        withInvoice = true,
        isLoading = false,
        paymentsData = payments,
        configuration = defaultConfiguration,
    }: {
        withInvoice?: boolean;
        isLoading?: boolean;
        paymentsData?: Payment[];
        configuration?: SolvimonInvoiceEntryProps['configuration'];
    } = {}) => {
        mockUseInvoice.mockReturnValue({
            invoice: ref(withInvoice ? invoice : undefined),
            downloadInvoicePdf: mockDownloadInvoicePdf,
            get: mockInvoiceGet,
            isPending: ref(false),
            error: ref(null),
        });

        mockUsePayments.mockReturnValue({
            payments: ref(paymentsData),
            get: mockPaymentsGet,
            isPending: ref(false),
            error: ref(null),
        });

        mockUseLoadInitialData.mockReturnValue({
            isLoading: ref(isLoading),
        });

        const wrapper = mount(InvoiceEntry, {
            props: { ...defaultProps, configuration },
            global: {
                stubs: { teleport: true },
            },
        });

        await flushPromises();

        return wrapper;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockInvoiceGet.mockResolvedValue(invoice);
        mockPaymentsGet.mockResolvedValue(payments);
        mockDownloadInvoicePdf.mockResolvedValue(undefined);
    });

    it('throws when no invoice ID is provided in the configuration', () => {
        expect(() =>
            mount(InvoiceEntry, {
                props: {
                    ...defaultProps,
                    configuration: { invoiceId: undefined as unknown as Invoice['id'] },
                },
                global: { stubs: { teleport: true } },
            }),
        ).toThrow('Missing invoice id');
    });

    it('requests the invoice using the invoice ID from the configuration', async () => {
        await mountComponent();

        expect(mockUseInvoice).toHaveBeenCalledWith({ invoiceId });
    });

    it('fetches the invoice data on mount', async () => {
        await mountComponent();

        expect(mockInvoiceGet).toHaveBeenCalledOnce();
    });

    it('fetches payments for the configured invoice ID on mount', async () => {
        await mountComponent();

        expect(mockPaymentsGet).toHaveBeenCalledWith(invoiceId);
    });

    it('does not render the invoice when data has not yet loaded', async () => {
        const wrapper = await mountComponent({ withInvoice: false });

        expect(wrapper.text()).toBe('');
    });

    it('renders the invoice details section when data is loaded', async () => {
        const wrapper = await mountComponent();

        expect(wrapper.text()).toContain('Invoice details');
        expect(wrapper.text()).toContain('Invoice date');
        expect(wrapper.text()).toContain('15/01/2024');
    });

    it('renders the payment history section when enablePaymentAttempts is true and payments exist', async () => {
        const wrapper = await mountComponent();

        expect(wrapper.text()).toContain('Payment history');
        expect(wrapper.text()).toContain('Payment attempt');
    });

    it('hides the payment history section when enablePaymentAttempts is false', async () => {
        const wrapper = await mountComponent({
            configuration: { ...defaultConfiguration, enablePaymentAttempts: false },
        });

        expect(wrapper.text()).not.toContain('Payment history');
    });

    it('hides the payment history section when there are no payments', async () => {
        const wrapper = await mountComponent({ paymentsData: [] });

        expect(wrapper.text()).not.toContain('Payment history');
    });

    it('renders the customer billing information when enableCustomerBillingInformation is true', async () => {
        const wrapper = await mountComponent();

        expect(wrapper.text()).toContain('Your billing information');
    });

    it('hides the customer billing information when enableCustomerBillingInformation is false', async () => {
        const wrapper = await mountComponent({
            configuration: { ...defaultConfiguration, enableCustomerBillingInformation: false },
        });

        expect(wrapper.text()).not.toContain('Your billing information');
    });
});
