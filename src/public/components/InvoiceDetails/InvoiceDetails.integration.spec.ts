import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoiceDetailsEntry from './InvoiceDetails.entry.vue';
import type { SolvimonInvoiceDetailsEntryProps } from './InvoiceDetails.entry.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const { mockUseInvoiceData } = vi.hoisted(() => ({
    mockUseInvoiceData: vi.fn(),
}));

vi.mock('./InvoiceDetails.entry.ce', () => ({
    COMPONENT_NAME: 'solvimon-invoice-details',
    SolvimonInvoiceDetails: {},
    defineSolvimonInvoiceDetails: () => {},
}));

vi.mock('@/composables/useInvoiceData', () => ({
    useInvoiceData: mockUseInvoiceData,
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

describe('InvoiceDetails entry component', () => {
    const invoiceId = 'inv_123' as Invoice['id'];

    const invoice = {
        id: invoiceId,
        invoice_number: 'INV-001',
        invoice_date: '2024-01-15T00:00:00Z',
        due_date: '2024-02-15T00:00:00Z',
        customer: {
            id: 'cus_123',
            timezone: 'Europe/Amsterdam',
        },
    } as unknown as Invoice;

    const defaultProps: SolvimonInvoiceDetailsEntryProps = {
        environment: 'TEST',
        locale: 'en-US',
        customElementName: 'solvimon-invoice-details',
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

    it('throws when no invoice ID is provided in the configuration', () => {
        expect(() =>
            mount(InvoiceDetailsEntry, {
                props: {
                    ...defaultProps,
                    configuration: { invoiceId: undefined as unknown as Invoice['id'] },
                },
                global: { stubs: { teleport: true } },
            }),
        ).toThrow('Missing invoice id');
    });

    it('requests invoice data using the invoice ID from the configuration', () => {
        mountComponent();

        expect(mockUseInvoiceData).toHaveBeenCalledWith(invoiceId);
    });

    it('does not render when invoice data has not yet loaded', () => {
        const wrapper = mountComponent({ withInvoice: false });

        expect(wrapper.text()).toBe('');
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
