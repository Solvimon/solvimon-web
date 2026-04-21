import type { Invoice, Payment } from '@solvimon/types';
import { ApiStatus } from '@solvimon/types';
import { usePayments } from './usePayments';

const mockGetPayments = vi.fn<(invoiceId: Invoice['id']) => Promise<{ data: Payment[] }>>();

vi.mock('@/services/payments', () => ({
    createPaymentsService: vi.fn(() => ({
        getPayments: mockGetPayments,
    })),
}));

describe('usePayments', () => {
    beforeEach(() => {
        mockGetPayments.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('fetches payments for the given invoice id and updates state', async () => {
        const invoiceId = 'inv_123' as Invoice['id'];
        const response = [
            {
                id: 'pay_1',
            },
        ] as Payment[];

        mockGetPayments.mockResolvedValue({ data: response });

        const { data, fetch, error, apiStatus, isPending } = usePayments();

        expect(data.value).toBeUndefined();
        expect(error.value).toBeNull();
        expect(apiStatus.value).toBe(ApiStatus.Initial);
        expect(isPending.value).toBe(false);

        const promise = fetch(invoiceId);

        expect(apiStatus.value).toBe(ApiStatus.Loading);
        expect(isPending.value).toBe(true);

        await promise;

        expect(mockGetPayments).toHaveBeenCalledTimes(1);
        expect(mockGetPayments).toHaveBeenCalledWith(invoiceId);
        expect(data.value).toStrictEqual(response);
        expect(error.value).toBeNull();
        expect(apiStatus.value).toBe(ApiStatus.Done);
        expect(isPending.value).toBe(false);
    });

    it('sets error state when the payments service fails', async () => {
        const invoiceId = 'inv_123' as Invoice['id'];
        const serviceError = new Error('Network error');

        mockGetPayments.mockRejectedValue(serviceError);

        const { data, fetch, error, apiStatus, isPending } = usePayments();

        await expect(fetch(invoiceId)).rejects.toBeUndefined();

        expect(mockGetPayments).toHaveBeenCalledWith(invoiceId);
        expect(data.value).toBeUndefined();
        expect(error.value).toStrictEqual(serviceError);
        expect(apiStatus.value).toBe(ApiStatus.Failed);
        expect(isPending.value).toBe(false);
    });
});
