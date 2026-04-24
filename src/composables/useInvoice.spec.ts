import type { Invoice } from '@solvimon/types';
import { ApiStatus } from '@solvimon/types';
import { useInvoice } from './useInvoice';

const mockGetInvoice = vi.fn<(invoiceId: Invoice['id']) => Promise<Invoice>>();
const mockGetInvoicePdf = vi.fn<(invoiceId: Invoice['id']) => Promise<void>>();

vi.mock('@/services/invoices', () => ({
    createInvoicesService: vi.fn(() => ({
        getInvoice: mockGetInvoice,
        getInvoicePdf: mockGetInvoicePdf,
    })),
}));

describe('useInvoice', () => {
    beforeEach(() => {
        mockGetInvoice.mockReset();
        mockGetInvoicePdf.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('fetches the invoice for the given invoice id and updates state', async () => {
        const invoiceId = 'invo_123' as Invoice['id'];
        const response = {
            id: invoiceId,
            invoice_number: '2024-001',
        } as Invoice;

        mockGetInvoice.mockResolvedValue(response);

        const { invoice, get, error, apiStatus, isPending, downloadInvoicePdf } = useInvoice({
            invoiceId,
        });

        expect(invoice.value).toBeUndefined();
        expect(error.value).toBeNull();
        expect(apiStatus.value).toBe(ApiStatus.Initial);
        expect(isPending.value).toBe(false);
        expect(downloadInvoicePdf).toBe(mockGetInvoicePdf);

        const promise = get();

        expect(apiStatus.value).toBe(ApiStatus.Loading);
        expect(isPending.value).toBe(true);

        await expect(promise).resolves.toStrictEqual(response);

        expect(mockGetInvoice).toHaveBeenCalledTimes(1);
        expect(mockGetInvoice).toHaveBeenCalledWith(invoiceId);
        expect(invoice.value).toStrictEqual(response);
        expect(error.value).toBeNull();
        expect(apiStatus.value).toBe(ApiStatus.Done);
        expect(isPending.value).toBe(false);
    });

    it('sets error state when the invoice service fails', async () => {
        const invoiceId = 'invo_123' as Invoice['id'];
        const serviceError = new Error('Network error');

        mockGetInvoice.mockRejectedValue(serviceError);

        const { invoice, get, error, apiStatus, isPending } = useInvoice({
            invoiceId,
        });

        await expect(get()).rejects.toBeUndefined();

        expect(mockGetInvoice).toHaveBeenCalledWith(invoiceId);
        expect(invoice.value).toBeUndefined();
        expect(error.value).toStrictEqual(serviceError);
        expect(apiStatus.value).toBe(ApiStatus.Failed);
        expect(isPending.value).toBe(false);
    });
});
