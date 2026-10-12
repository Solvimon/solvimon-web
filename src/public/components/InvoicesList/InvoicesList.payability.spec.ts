import { flushPromises, mount } from '@vue/test-utils';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoicesList from './InvoicesList.vue';
import InvoicesListEntryView from './InvoicesList.entry.view.vue';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const { mockGetInvoices } = vi.hoisted(() => ({ mockGetInvoices: vi.fn() }));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ getInvoices: mockGetInvoices }),
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
    const { defineComponent, h } = await import('vue');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            props: { title: String },
            setup(props) {
                return () => h('div', { class: 'sv-error-notification-stub' }, props.title);
            },
        }),
    });
});

const anInvoice = (overrides: Record<string, unknown> = {}): Invoice =>
    ({
        id: 'inv_1',
        invoice_number: 'INV-1',
        invoice_date: '2026-05-20T12:00:00.000Z',
        status: 'FINAL',
        type: 'STANDARD',
        paid: false,
        payment_status: 'UNPAID',
        on_hold: false,
        open_invoice_amount: { currency: 'EUR', quantity: '100.00' },
        invoice_amount_including_tax: { currency: 'EUR', quantity: '100.00' },
        customer: { timezone: 'Europe/Amsterdam' },
        ...overrides,
    }) as unknown as Invoice;

const hasPayButton = (invoice: Invoice) => {
    const wrapper = mount(InvoicesList, {
        props: { invoices: [invoice], isLoading: false, hasMoreItems: false },
    });
    return wrapper.findAll('button').some((button) => button.text() === 'Pay');
};

describe('InvoicesList, which invoices offer Pay', () => {
    it('offers Pay on a final, unpaid invoice', () => {
        expect(hasPayButton(anInvoice())).toBe(true);
    });

    it('offers Pay on a final invoice that is partly paid', () => {
        expect(
            hasPayButton(
                anInvoice({
                    payment_status: 'PARTIALLY_PAID',
                    open_invoice_amount: { currency: 'EUR', quantity: '40.00' },
                }),
            ),
        ).toBe(true);
    });

    it('offers Pay on a one-off invoice', () => {
        expect(hasPayButton(anInvoice({ type: 'ONE_OFF' }))).toBe(true);
    });

    it.each([
        ['a credit note', { type: 'CREDIT' }],
        ['a one-off credit note', { type: 'ONE_OFF_CREDIT' }],
        ['a voided invoice', { status: 'VOID' }],
        ['a draft', { status: 'DRAFT' }],
        ['a draft on hold', { status: 'DRAFT', on_hold: true }],
        ['an open invoice', { status: 'OPEN' }],
        ['an empty invoice', { status: 'EMPTY' }],
        ['an archived invoice', { status: 'ARCHIVED' }],
        ['an invoice with nothing open', { open_invoice_amount: { quantity: '0.00' } }],
        ['an invoice with no open amount', { open_invoice_amount: undefined }],
        ['an invoice paid by payment_status', { paid: null, payment_status: 'PAID' }],
        ['an overpaid invoice', { paid: null, payment_status: 'OVERPAID' }],
        ['an invoice marked paid', { paid: true }],
    ])('offers no Pay on %s', (_, overrides) => {
        expect(hasPayButton(anInvoice(overrides))).toBe(false);
    });
});

describe('InvoicesList entry, the batch size it asks for', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInvoices.mockResolvedValue({ data: [], links: {} });
    });

    const requestedPageSize = async (batchSize: number | undefined) => {
        mount(InvoicesListEntryView, {
            props: {
                environment: 'TEST',
                locale: 'en-US',
                portalObject: createTestPortalObject(),
                configuration: { pagination: { batchSize } },
            },
        });
        await flushPromises();
        return mockGetInvoices.mock.lastCall?.[0].pagination.pageSize;
    };

    it.each([
        [500, 50],
        [50, 50],
        [0, 15],
        [undefined, 15],
        [-1, 1],
        [2.7, 2],
    ])('asks for a valid limit when configured with %s', async (batchSize, expected) => {
        expect(await requestedPageSize(batchSize)).toBe(expected);
    });
});
