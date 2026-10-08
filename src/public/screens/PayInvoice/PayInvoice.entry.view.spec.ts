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

const invoice = {
    id: 'invo_1',
    customer: { id: 'cust_1' },
    open_invoice_amount: { currency: 'EUR', quantity: '99.00' },
} as unknown as Invoice;

const options: PaymentMethodOptionsResponse = [
    createPaymentMethodOptionEntry({ paymentAcceptorId: 'paya_1' }),
];

/** The screen hands its data to the host through a slot; that is what a test reads. */
const mountEntryView = async () => {
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

    mount(PayInvoiceEntryView, {
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

    return { latestSlotProps: () => slotProps.at(-1) };
};

describe('PayInvoice.entry.view', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Asked of the invoice, so the API answers with the acceptors it can be paid through rather
    // than every acceptor the customer has — paying through one of those fails with a 400 the
    // customer can do nothing about (DD-3533).
    it('asks for the options of the invoice being paid, not of the customer alone', async () => {
        await mountEntryView();

        expect(mockGetOptions).toHaveBeenCalledWith({
            customerId: 'cust_1',
            invoiceId: 'invo_1',
            amount: { currency: 'EUR', quantity: '99.00' },
        });
    });

    it('offers what came back to pay the invoice with', async () => {
        const { latestSlotProps } = await mountEntryView();

        expect(latestSlotProps()?.paymentMethodOptions).toEqual(options);
    });
});
