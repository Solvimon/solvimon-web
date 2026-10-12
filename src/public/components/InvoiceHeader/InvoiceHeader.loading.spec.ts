import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, type PropType } from 'vue';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoiceHeaderEntry from './InvoiceHeader.entry.vue';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

// useInvoice, usePayments, useLoadInitialData and InvoiceEntryView run for real.
const { mockGetInvoice, mockGetPayments } = vi.hoisted(() => ({
    mockGetInvoice: vi.fn(),
    mockGetPayments: vi.fn(),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ getInvoice: mockGetInvoice, getInvoicePdf: vi.fn() }),
}));

vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({ getPayments: mockGetPayments }),
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', async () => {
    const { providerMockLogger } = await import('@/test-utils/providerMock');
    return { useLogger: () => providerMockLogger };
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        InvoiceHeader: defineComponent({
            props: { invoice: Object as PropType<Invoice> },
            setup(props) {
                return () => h('div', { class: 'header-stub' }, props.invoice?.invoice_number);
            },
        }),
        ErrorNotification: defineComponent({
            props: { title: String },
            setup(props) {
                return () => h('div', { class: 'sv-error-notification-stub' }, props.title);
            },
        }),
    });
});

const anInvoice = (id: string, invoiceNumber: string) =>
    ({ id, invoice_number: invoiceNumber, customer: { timezone: 'UTC' } }) as unknown as Invoice;

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const props = (invoiceId: string) => ({
    environment: 'TEST' as const,
    locale: 'en-US',
    portalObject: createTestPortalObject(),
    configuration: { invoiceId },
});

describe('InvoiceHeader entry, loading for real', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('still shows the invoice when its payments answer 403', async () => {
        mockGetInvoice.mockResolvedValue(anInvoice('inv_1', 'INV-1'));
        mockGetPayments.mockRejectedValue(
            Object.assign(new Error('Forbidden'), { statusCode: 403 }),
        );

        const wrapper = mount(InvoiceHeaderEntry, { props: props('inv_1') });
        await flushPromises();

        expect(wrapper.find('[data-testid="invoice-skeleton"]').exists()).toBe(false);
        expect(wrapper.text()).toContain('INV-1');
    });

    it('says so when the invoice answers 500', async () => {
        mockGetInvoice.mockRejectedValue(new Error('Internal'));
        mockGetPayments.mockResolvedValue({ data: [] });

        const wrapper = mount(InvoiceHeaderEntry, { props: props('inv_1') });
        await flushPromises();

        expect(wrapper.text()).toContain('We could not load this invoice. Please try again.');
    });

    it('ignores a late answer for the invoice it showed before the id changed', async () => {
        const first = deferred<Invoice>();
        mockGetInvoice.mockImplementation((id: string) =>
            id === 'inv_1' ? first.promise : Promise.resolve(anInvoice('inv_2', 'INV-2')),
        );
        mockGetPayments.mockResolvedValue({ data: [] });

        const wrapper = mount(InvoiceHeaderEntry, { props: props('inv_1') });
        await flushPromises();
        await wrapper.setProps({ configuration: { invoiceId: 'inv_2' } });
        await flushPromises();
        first.resolve(anInvoice('inv_1', 'INV-1'));
        await flushPromises();

        expect(wrapper.text()).toContain('INV-2');
        expect(wrapper.text()).not.toContain('INV-1');
    });
});
