import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoiceDetailsEntry from './InvoiceDetails.entry.vue';
import type { SolvimonInvoiceDetailsEntryProps } from './InvoiceDetails.entry.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';
import { EntryProvider } from '@/components/providers';

const { mockUseInvoiceData } = vi.hoisted(() => ({
    mockUseInvoiceData: vi.fn(),
}));

vi.mock('@/composables/useInvoiceData', () => ({
    useInvoiceData: mockUseInvoiceData,
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
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

describe('InvoiceDetails entry component', () => {
    const invoiceId = 'inv_123' as Invoice['id'];

    const invoice = {
        id: invoiceId,
        invoice_number: 'INV-001',
        invoice_date: '2024-01-15T00:00:00Z',
        due_date: '2024-02-15T00:00:00Z',
        timezone: 'Europe/Amsterdam',
        customer: {
            id: 'cus_123',
            timezone: 'Europe/Amsterdam',
        },
    } as unknown as Invoice;

    const defaultProps: SolvimonInvoiceDetailsEntryProps = {
        environment: 'TEST',
        locale: 'en-US',
        portalObject: createTestPortalObject(),
        configuration: { invoiceId },
    };

    const mountComponent = ({
        withInvoice = true,
        isPending = false,
    }: {
        withInvoice?: boolean;
        isPending?: boolean;
    } = {}) => {
        mockUseInvoiceData.mockReturnValue({
            data: ref(withInvoice ? { invoice } : undefined),
            isPending: ref(isPending),
        });

        return mount(InvoiceDetailsEntry, {
            props: defaultProps,
            global: {
                stubs: { teleport: true },
            },
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('waits for an invoice ID instead of throwing when the configuration has none', () => {
        mockUseInvoiceData.mockReturnValue({ data: ref(undefined), isPending: ref(false) });

        const wrapper = mount(InvoiceDetailsEntry, {
            props: {
                ...defaultProps,
                configuration: { invoiceId: undefined as unknown as Invoice['id'] },
            },
            global: { stubs: { teleport: true } },
        });

        expect(wrapper.getComponent(EntryProvider).vm.$attrs['required-configuration']).toEqual({
            invoiceId: undefined,
        });
    });

    it('requests invoice data using the invoice ID from the configuration', () => {
        mountComponent();

        expect(mockUseInvoiceData).toHaveBeenCalledWith(invoiceId);
    });

    it('shows a skeleton while the invoice loads, rather than nothing', () => {
        const wrapper = mountComponent({ withInvoice: false, isPending: true });

        expect(wrapper.find('[data-testid="invoice-details-skeleton"]').exists()).toBe(true);
    });

    it('says so when the invoice could not be loaded', () => {
        const wrapper = mountComponent({ withInvoice: false });

        expect(wrapper.find('[data-testid="invoice-details-skeleton"]').exists()).toBe(false);
        expect(wrapper.text()).toContain('We could not load this invoice. Please try again.');
    });

    it('loads the other invoice when the configured invoice id changes', async () => {
        const wrapper = mountComponent();

        await wrapper.setProps({ configuration: { invoiceId: 'inv_456' } });

        expect(mockUseInvoiceData).toHaveBeenLastCalledWith('inv_456');
    });

    it("dates the invoice in the timezone it was issued in, not the customer's current one", () => {
        mockUseInvoiceData.mockReturnValue({
            data: ref({
                invoice: {
                    ...invoice,
                    // Midnight in Amsterdam is still the previous day in New York.
                    invoice_date: '2024-01-14T23:30:00Z',
                    timezone: 'Europe/Amsterdam',
                    customer: { id: 'cus_123', timezone: 'America/New_York' },
                },
            }),
            isPending: ref(false),
        });

        const wrapper = mount(InvoiceDetailsEntry, {
            props: defaultProps,
            global: { stubs: { teleport: true } },
        });

        expect(wrapper.text()).toContain('15/01/2024');
    });

    it('renders the skeleton when already-loaded data is being reloaded', () => {
        const wrapper = mountComponent({ isPending: true });

        expect(wrapper.get('[data-testid="invoice-details-skeleton"]')).toBeTruthy();
        expect(wrapper.text()).toBe('');
    });

    it('renders the invoice details section when data is loaded', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Invoice details');
        expect(wrapper.text()).toContain('Invoice date');
        expect(wrapper.text()).toContain('15/01/2024');
    });

    it('renders the due date when the invoice has a due date', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Due date');
        expect(wrapper.text()).toContain('15/02/2024');
    });
});
