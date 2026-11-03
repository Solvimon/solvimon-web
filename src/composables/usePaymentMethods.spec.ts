import { DEFAULT_PAYMENT_METHOD_FIRST, usePaymentMethods } from './usePaymentMethods';

const { mockGetPaymentMethods } = vi.hoisted(() => ({ mockGetPaymentMethods: vi.fn() }));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({ getPaymentMethods: mockGetPaymentMethods }),
}));

const page = (data: unknown[]) => ({ data, pagination: { total_pages: 1, page: 1 } });

describe('usePaymentMethods', () => {
    beforeEach(() => {
        mockGetPaymentMethods.mockResolvedValue(page([]));
    });

    it('asks for the methods in the order the API keeps them by default', async () => {
        await usePaymentMethods({ customerId: 'cust_1' }).fetchAll();

        expect(mockGetPaymentMethods).toHaveBeenCalledWith({
            customerId: 'cust_1',
            pagination: { page: 1, pageSize: 15 },
        });
    });

    it('asks the API to put the default method first', async () => {
        await usePaymentMethods({
            customerId: 'cust_1',
            order: DEFAULT_PAYMENT_METHOD_FIRST,
        }).fetchAll();

        expect(mockGetPaymentMethods).toHaveBeenCalledWith({
            customerId: 'cust_1',
            pagination: { page: 1, pageSize: 15, orderBy: 'default', orderDirection: 'desc' },
        });
    });
});
