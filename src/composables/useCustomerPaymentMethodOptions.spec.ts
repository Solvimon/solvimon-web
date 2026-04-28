import type {
    Amount,
    Customer,
    PaymentMethodOption,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import { ApiStatus } from '@solvimon/solvimon-types';
import { useCustomerPaymentMethodOptions } from './useCustomerPaymentMethodOptions';

const mockGetPaymentMethodOptions =
    vi.fn<
        (payload: {
            customerId: Customer['id'];
            amount?: Amount;
        }) => Promise<PaymentMethodOptionsResponse>
    >();

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: vi.fn(() => ({
        getPaymentMethodOptions: mockGetPaymentMethodOptions,
    })),
}));

describe('useCustomerPaymentMethodOptions', () => {
    beforeEach(() => {
        mockGetPaymentMethodOptions.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('fetches customer payment method options and flattens them into items', async () => {
        const customerId = 'cust_123' as Customer['id'];
        const amount = { quantity: '100', currency: 'EUR' } as Amount;
        const optionA = { name: 'Card' } as PaymentMethodOption;
        const optionB = { name: 'SEPA' } as PaymentMethodOption;
        const response = [
            { options: [optionA] },
            { options: [optionB] },
        ] as unknown as PaymentMethodOptionsResponse;

        mockGetPaymentMethodOptions.mockResolvedValue(response);

        const customerPaymentMethodOptions = useCustomerPaymentMethodOptions({
            customerId,
            amount,
        });

        expect(customerPaymentMethodOptions.items.value).toEqual([]);
        expect(customerPaymentMethodOptions.apiStatus.value).toBe(ApiStatus.Initial);
        expect(customerPaymentMethodOptions.isPending.value).toBe(false);

        const promise = customerPaymentMethodOptions.fetch();

        expect(customerPaymentMethodOptions.apiStatus.value).toBe(ApiStatus.Loading);
        expect(customerPaymentMethodOptions.isPending.value).toBe(true);

        await expect(promise).resolves.toEqual([optionA, optionB]);

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(1);
        expect(mockGetPaymentMethodOptions).toHaveBeenCalledWith({
            customerId,
            amount,
        });
        expect(customerPaymentMethodOptions.items.value).toEqual([optionA, optionB]);
        expect(customerPaymentMethodOptions.apiStatus.value).toBe(ApiStatus.Done);
        expect(customerPaymentMethodOptions.isPending.value).toBe(false);
    });

    it('captures errors when fetching fails', async () => {
        const customerId = 'cust_123' as Customer['id'];
        const error = new Error('failed');

        mockGetPaymentMethodOptions.mockRejectedValue(error);

        const customerPaymentMethodOptions = useCustomerPaymentMethodOptions({
            customerId,
        });

        await expect(customerPaymentMethodOptions.fetch()).rejects.toBeUndefined();

        expect(customerPaymentMethodOptions.error.value).toBe(error);
        expect(customerPaymentMethodOptions.apiStatus.value).toBe(ApiStatus.Failed);
        expect(customerPaymentMethodOptions.isPending.value).toBe(false);
    });
});
