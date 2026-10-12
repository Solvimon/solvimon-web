import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { Invoice, Payment } from '@solvimon/solvimon-types';
import InvoiceHeaderEntry from './InvoiceHeader.entry.vue';
import type { SolvimonInvoiceHeaderEntryProps } from './InvoiceHeader.entry.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const {
    mockUseInvoice,
    mockUsePayments,
    mockUseLoadInitialData,
    mockDownloadInvoicePdf,
    mockInvoiceGet,
    mockPaymentsGet,
} = vi.hoisted(() => ({
    mockUseInvoice: vi.fn(),
    mockUsePayments: vi.fn(),
    mockUseLoadInitialData: vi.fn(),
    mockDownloadInvoicePdf: vi.fn(),
    mockInvoiceGet: vi.fn(),
    mockPaymentsGet: vi.fn(),
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
    return createSolvimonUiMock({
        InvoiceHeader: defineComponent({
            name: 'InvoiceHeaderStub',
            template: '<div data-testid="invoice-header-stub" />',
        }),
        // ErrorNotification resolves its own IntlProvider internally, which is not mounted here.
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup(props) {
                return () => h('div', { class: 'sv-error-notification-stub' }, props.title);
            },
        }),
    });
});

describe('InvoiceHeader entry component', () => {
    const invoiceId = 'inv_123' as Invoice['id'];

    const invoice = {
        id: invoiceId,
        invoice_number: 'INV-001',
        invoice_date: '2024-01-15T00:00:00Z',
        customer: { id: 'cus_123', timezone: 'Europe/Amsterdam' },
        invoice_amount_including_tax: { currency: 'EUR', quantity: '1000' },
    } as unknown as Invoice;

    const payments = [
        {
            id: 'pay_123',
            result: 'AUTHORIZED',
            created_at: '2024-01-15T10:00:00Z',
            payment_method_details: { type: 'CARD' },
        },
    ] as unknown as Payment[];

    const defaultConfiguration: SolvimonInvoiceHeaderEntryProps['configuration'] = {
        invoiceId,
    };

    const defaultProps: SolvimonInvoiceHeaderEntryProps = {
        environment: 'TEST',
        locale: 'en-US',
        portalObject: createTestPortalObject(),
        configuration: defaultConfiguration,
    };

    const mountComponent = async ({
        withInvoice = true,
        isLoading = false,
        isInvoicePending = false,
        paymentsData = payments,
        configuration = defaultConfiguration,
    }: {
        withInvoice?: boolean;
        isLoading?: boolean;
        isInvoicePending?: boolean;
        paymentsData?: Payment[];
        configuration?: SolvimonInvoiceHeaderEntryProps['configuration'];
    } = {}) => {
        mockUseInvoice.mockReturnValue({
            invoice: ref(withInvoice ? invoice : undefined),
            downloadInvoicePdf: mockDownloadInvoicePdf,
            get: mockInvoiceGet,
            isPending: ref(isInvoicePending),
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

        const wrapper = mount(InvoiceHeaderEntry, {
            props: { ...defaultProps, configuration },
            global: { stubs: { teleport: true } },
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
            mount(InvoiceHeaderEntry, {
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

    it('shows a skeleton while the invoice loads, rather than nothing', async () => {
        const wrapper = await mountComponent({ withInvoice: false, isLoading: true });

        expect(wrapper.find('[data-testid="invoice-skeleton"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="invoice-header-stub"]').exists()).toBe(false);
    });

    it('keeps the skeleton up while the invoice is still on its way after the payments failed', async () => {
        const wrapper = await mountComponent({ withInvoice: false, isInvoicePending: true });

        expect(wrapper.find('[data-testid="invoice-skeleton"]').exists()).toBe(true);
        expect(wrapper.find('.sv-error-notification-stub').exists()).toBe(false);
    });

    it('says so when the invoice could not be loaded', async () => {
        const wrapper = await mountComponent({ withInvoice: false });

        expect(wrapper.find('[data-testid="invoice-skeleton"]').exists()).toBe(false);
        expect(wrapper.text()).toContain('We could not load this invoice. Please try again.');
    });

    it('loads the other invoice when the configured invoice id changes', async () => {
        const wrapper = await mountComponent();

        await wrapper.setProps({
            configuration: { ...defaultConfiguration, invoiceId: 'inv_456' },
        });
        await flushPromises();

        expect(mockUseInvoice).toHaveBeenLastCalledWith({ invoiceId: 'inv_456' });
        expect(mockPaymentsGet).toHaveBeenLastCalledWith('inv_456');
    });

    it('renders the invoice header when data is loaded', async () => {
        const wrapper = await mountComponent();

        expect(wrapper.find('[data-testid="invoice-header-stub"]').exists()).toBe(true);
    });
});
