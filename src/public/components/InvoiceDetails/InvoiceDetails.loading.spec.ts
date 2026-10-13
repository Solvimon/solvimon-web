import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoiceDetailsEntry from './InvoiceDetails.entry.vue';
import type { SolvimonInvoiceDetailsEntryProps } from './InvoiceDetails.entry.types';
import PaymentHistoryEntry from '@/public/components/PaymentHistory/PaymentHistory.entry.vue';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

// Only the services are replaced: useInvoiceData and the entry views run for real.
const { mockGetInvoice, mockGetPayments } = vi.hoisted(() => ({
    mockGetInvoice: vi.fn(),
    mockGetPayments: vi.fn(),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ getInvoice: mockGetInvoice }),
}));

vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({ getPayments: mockGetPayments }),
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            props: { title: String },
            setup(props) {
                return () => h('div', { class: 'sv-error-notification-stub' }, props.title);
            },
        }),
    });
});

const anInvoice = (id: string, invoiceNumber: string): Invoice =>
    ({
        id,
        invoice_number: invoiceNumber,
        invoice_date: '2024-01-15T12:00:00Z',
        due_date: '2024-02-15T12:00:00Z',
        timezone: 'Europe/Amsterdam',
        customer: { id: 'cus_123', timezone: 'Europe/Amsterdam' },
    }) as unknown as Invoice;

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const props = (invoiceId: string): SolvimonInvoiceDetailsEntryProps => ({
    environment: 'TEST',
    locale: 'en-US',
    portalObject: createTestPortalObject(),
    configuration: { invoiceId },
});

describe('InvoiceDetails entry, loading for real', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the skeleton until a slow invoice arrives, then the invoice', async () => {
        const pending = deferred<Invoice>();
        mockGetInvoice.mockReturnValue(pending.promise);

        const wrapper = mount(InvoiceDetailsEntry, { props: props('inv_1') });
        await flushPromises();
        expect(wrapper.find('[data-testid="invoice-details-skeleton"]').exists()).toBe(true);

        pending.resolve(anInvoice('inv_1', 'INV-1'));
        await flushPromises();

        expect(wrapper.find('[data-testid="invoice-details-skeleton"]').exists()).toBe(false);
        expect(wrapper.text()).toContain('15/01/2024');
    });

    it.each([404, 500])('says so when the invoice answers %i', async (statusCode) => {
        mockGetInvoice.mockRejectedValue(Object.assign(new Error('failed'), { statusCode }));

        const wrapper = mount(InvoiceDetailsEntry, { props: props('inv_1') });
        await flushPromises();

        expect(wrapper.text()).toContain('We could not load this invoice. Please try again.');
    });

    it('never asks for the payments it does not show', async () => {
        mockGetInvoice.mockResolvedValue(anInvoice('inv_1', 'INV-1'));

        mount(InvoiceDetailsEntry, { props: props('inv_1') });
        await flushPromises();

        expect(mockGetInvoice).toHaveBeenCalledWith('inv_1');
        expect(mockGetPayments).not.toHaveBeenCalled();
    });

    it('ignores a late answer for the invoice it was showing before the id changed', async () => {
        const first = deferred<Invoice>();
        const second = deferred<Invoice>();
        mockGetInvoice.mockImplementation((id: string) =>
            id === 'inv_1' ? first.promise : second.promise,
        );

        const wrapper = mount(InvoiceDetailsEntry, { props: props('inv_1') });
        await flushPromises();
        await wrapper.setProps({ configuration: { invoiceId: 'inv_2' } });
        await flushPromises();

        second.resolve({ ...anInvoice('inv_2', 'INV-2'), invoice_date: '2024-03-20T12:00:00Z' });
        await flushPromises();
        first.resolve(anInvoice('inv_1', 'INV-1'));
        await flushPromises();

        expect(wrapper.text()).toContain('20/03/2024');
        expect(wrapper.text()).not.toContain('15/01/2024');
    });
});

describe('PaymentHistory entry, loading for real', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('says the payment history could not be loaded when the payments answer 403', async () => {
        mockGetInvoice.mockResolvedValue(anInvoice('inv_1', 'INV-1'));
        mockGetPayments.mockRejectedValue(
            Object.assign(new Error('Forbidden'), { statusCode: 403 }),
        );

        const wrapper = mount(PaymentHistoryEntry, { props: props('inv_1') });
        await flushPromises();

        expect(wrapper.find('[data-testid="payment-history-skeleton"]').exists()).toBe(false);
        expect(wrapper.text()).toContain(
            'We could not load the payment history. Please try again.',
        );
    });

    it('fetches the payments of the new invoice when the id changes', async () => {
        mockGetInvoice.mockResolvedValue(anInvoice('inv_1', 'INV-1'));
        mockGetPayments.mockResolvedValue({ data: [] });

        const wrapper = mount(PaymentHistoryEntry, { props: props('inv_1') });
        await flushPromises();
        await wrapper.setProps({ configuration: { invoiceId: 'inv_2' } });
        await flushPromises();

        expect(mockGetPayments).toHaveBeenLastCalledWith('inv_2');
    });
});
