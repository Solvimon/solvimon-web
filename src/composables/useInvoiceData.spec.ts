import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type { Invoice } from '@solvimon/solvimon-types';
import { useInvoiceData } from './useInvoiceData';

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

describe('useInvoiceData', () => {
    const invoice = { id: 'inv_123' } as Invoice;
    const payments = { data: [{ id: 'pay_1' }] };

    const mountComposable = async (options?: Parameters<typeof useInvoiceData>[1]) => {
        let result!: ReturnType<typeof useInvoiceData>;
        mount(
            defineComponent({
                setup() {
                    result = useInvoiceData('inv_123', options);
                    return () => null;
                },
            }),
        );
        await flushPromises();
        return result;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInvoice.mockResolvedValue(invoice);
        mockGetPayments.mockResolvedValue(payments);
    });

    it('fetches only the invoice unless the payments are asked for', async () => {
        const { data, isPending } = await mountComposable();

        expect(mockGetPayments).not.toHaveBeenCalled();
        expect(data.value).toEqual({ invoice, paymentAttempts: undefined });
        expect(isPending.value).toBe(false);
    });

    it('keeps the invoice when the payments it was not asked for would have failed', async () => {
        mockGetPayments.mockRejectedValue(new Error('Forbidden'));

        const { data } = await mountComposable();

        expect(data.value?.invoice).toEqual(invoice);
    });

    it('fetches the payments alongside the invoice when asked to', async () => {
        const { data } = await mountComposable({ includePayments: true });

        expect(mockGetPayments).toHaveBeenCalledWith('inv_123');
        expect(data.value).toEqual({ invoice, paymentAttempts: payments });
    });

    it('settles empty when the invoice fails to load', async () => {
        mockGetInvoice.mockRejectedValue(new Error('Boom'));

        const { data, isPending } = await mountComposable();

        expect(data.value).toBeUndefined();
        expect(isPending.value).toBe(false);
    });
});
