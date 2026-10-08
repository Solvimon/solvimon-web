import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { Invoice, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import PayInvoiceEntryView from './PayInvoice.entry.view.vue';
import { createPaymentMethodOptionEntry } from '@/test-utils/paymentMethodOptionsFixture';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const { mockUseInvoice, mockUsePaymentMethodOptions, mockGetInvoice, mockGetOptions } = vi.hoisted(
    () => ({
        mockUseInvoice: vi.fn(),
        mockUsePaymentMethodOptions: vi.fn(),
        mockGetInvoice: vi.fn(),
        mockGetOptions: vi.fn(),
    }),
);

vi.mock('@/composables/useInvoice', () => ({ useInvoice: mockUseInvoice }));

vi.mock('@/composables/usePaymentMethodOptions', () => ({
    usePaymentMethodOptions: mockUsePaymentMethodOptions,
}));

vi.mock('@/composables/usePayments', () => ({
    usePayments: () => ({ payments: ref([]), get: vi.fn().mockResolvedValue([]) }),
}));

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: () => ({ fetchInitial: vi.fn().mockResolvedValue([]) }),
}));

vi.mock('@/composables/useLoadInitialData', () => ({
    useLoadInitialData: () => ({ isLoading: ref(false) }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    return { ...actual, getCustomerCountry: () => 'NL' };
});

const ALLOWED_ACCEPTOR_ID = 'paya_allowed';
const OTHER_ACCEPTOR_ID = 'paya_other';

const createInvoice = (paymentAcceptorIds?: string[]) =>
    ({
        id: 'invo_1',
        customer: { id: 'cust_1' },
        open_invoice_amount: { currency: 'EUR', quantity: '99.00' },
        ...(paymentAcceptorIds ? { payment_acceptor_ids: paymentAcceptorIds } : {}),
    }) as unknown as Invoice;

const options: PaymentMethodOptionsResponse = [
    createPaymentMethodOptionEntry({ paymentAcceptorId: ALLOWED_ACCEPTOR_ID }),
    createPaymentMethodOptionEntry({ paymentAcceptorId: OTHER_ACCEPTOR_ID }),
];

/** The screen hands its data to the host through a slot; that is what a test reads. */
const mountEntryView = async (invoice: Invoice) => {
    mockUseInvoice.mockReturnValue({
        invoice: ref(invoice),
        get: mockGetInvoice.mockResolvedValue(invoice),
        downloadInvoicePdf: vi.fn(),
        error: ref(undefined),
    });
    mockUsePaymentMethodOptions.mockReturnValue({
        paymentMethodOptions: ref(options),
        get: mockGetOptions.mockResolvedValue(options),
    });

    const slotProps: Record<string, unknown>[] = [];

    const wrapper = mount(PayInvoiceEntryView, {
        props: {
            portalObject: createTestPortalObject(),
            environment: 'TEST',
            configuration: { invoiceId: 'invo_1' },
        },
        slots: {
            default: (props: Record<string, unknown>) => {
                slotProps.push(props);
                return 'slot';
            },
        },
    });

    await flushPromises();

    return { wrapper, latestSlotProps: () => slotProps.at(-1) };
};

const offeredAcceptorIds = (slotProps: Record<string, unknown> | undefined) =>
    ((slotProps?.paymentMethodOptions ?? []) as PaymentMethodOptionsResponse).map(
        ({ payment_acceptor }) => payment_acceptor.id,
    );

describe('PayInvoice.entry.view', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // The options are looked up for the customer, so they carry acceptors this invoice refuses.
    it('offers only the methods on acceptors the invoice accepts', async () => {
        const { latestSlotProps } = await mountEntryView(createInvoice([ALLOWED_ACCEPTOR_ID]));

        expect(offeredAcceptorIds(latestSlotProps())).toEqual([ALLOWED_ACCEPTOR_ID]);
    });

    it('offers nothing when the invoice accepts none of them', async () => {
        const { latestSlotProps } = await mountEntryView(createInvoice(['paya_elsewhere']));

        expect(offeredAcceptorIds(latestSlotProps())).toEqual([]);
    });

    it('offers everything for an invoice that names no acceptors', async () => {
        const { latestSlotProps } = await mountEntryView(createInvoice());

        expect(offeredAcceptorIds(latestSlotProps())).toEqual([
            ALLOWED_ACCEPTOR_ID,
            OTHER_ACCEPTOR_ID,
        ]);
    });

    it('asks for the options of the customer the invoice is addressed to', async () => {
        await mountEntryView(createInvoice([ALLOWED_ACCEPTOR_ID]));

        expect(mockGetOptions).toHaveBeenCalledWith({
            customerId: 'cust_1',
            amount: { currency: 'EUR', quantity: '99.00' },
        });
    });
});
