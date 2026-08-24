import type {
    PaymentMethodOptionsResponse,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import { ApiStatus } from '@solvimon/solvimon-types';
import type { GetPaymentMethodOptionsPayload } from '@/services/paymentMethods.types';
import { usePaymentMethodOptions } from './usePaymentMethodOptions';

const mockGetPaymentMethodOptions =
    vi.fn<(payload: GetPaymentMethodOptionsPayload) => Promise<PaymentMethodOptionsResponse>>();

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: vi.fn(() => ({
        getPaymentMethodOptions: mockGetPaymentMethodOptions,
    })),
}));

describe('usePaymentMethodOptions', () => {
    beforeEach(() => {
        mockGetPaymentMethodOptions.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('fetches payment method options and updates state', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        const response = [{ id: 'pm_1' }] as unknown as PaymentMethodOptionsResponse;

        mockGetPaymentMethodOptions.mockResolvedValue(response);

        const paymentMethodOptions = usePaymentMethodOptions();

        expect(paymentMethodOptions.paymentMethodOptions.value).toEqual([]);
        expect(paymentMethodOptions.apiStatus.value).toBe(ApiStatus.Initial);

        await paymentMethodOptions.get({ subscriptionId, country: 'NL' });

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(1);
        expect(mockGetPaymentMethodOptions).toHaveBeenCalledWith({
            subscriptionId,
            country: 'NL',
        });
        expect(paymentMethodOptions.paymentMethodOptions.value).toEqual(response);
        expect(paymentMethodOptions.apiStatus.value).toBe(ApiStatus.Done);
    });

    it('captures errors when fetching fails', async () => {
        const error = new Error('failed');
        const payload: GetPaymentMethodOptionsPayload = {
            customerId: 'cust_123',
            country: 'NL',
        };

        mockGetPaymentMethodOptions.mockRejectedValue(error);

        const paymentMethodOptions = usePaymentMethodOptions();

        await expect(paymentMethodOptions.get(payload)).rejects.toBeUndefined();

        expect(paymentMethodOptions.error.value).toBe(error);
        expect(paymentMethodOptions.apiStatus.value).toBe(ApiStatus.Failed);
    });
    it('answers a repeated payload from what is already held', async () => {
        const response = [{ id: 'pm_1' }] as unknown as PaymentMethodOptionsResponse;
        const payload: GetPaymentMethodOptionsPayload = { customerId: 'cust_123', country: 'NL' };

        mockGetPaymentMethodOptions.mockResolvedValue(response);

        const paymentMethodOptions = usePaymentMethodOptions();

        await paymentMethodOptions.get(payload);
        await paymentMethodOptions.get({ ...payload });

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(1);
        expect(paymentMethodOptions.paymentMethodOptions.value).toEqual(response);
    });

    it('requests again when the payload changes', async () => {
        mockGetPaymentMethodOptions.mockResolvedValue(
            [] as unknown as PaymentMethodOptionsResponse,
        );

        const paymentMethodOptions = usePaymentMethodOptions();

        await paymentMethodOptions.get({ customerId: 'cust_123', country: 'NL' });
        await paymentMethodOptions.get({ customerId: 'cust_123', country: 'DE' });

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(2);
    });
});
