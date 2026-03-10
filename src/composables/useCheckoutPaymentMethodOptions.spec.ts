import type {
    CountryCode,
    PaymentMethodOptionsResponse,
    PricingPlanSubscription,
} from '@solvimon/types';
import { usePaymentMethodOptions } from './useCheckoutPaymentMethodOptions';

const mockGetPaymentMethodOptions =
    vi.fn<
        (args: {
            subscriptionId: PricingPlanSubscription['id'];
            country: CountryCode;
        }) => Promise<PaymentMethodOptionsResponse>
    >();

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

    it('fetches payment method options and updates ref', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        const country = 'NL' as CountryCode;
        const response = [{ id: 'pm_1' }] as unknown as PaymentMethodOptionsResponse;

        mockGetPaymentMethodOptions.mockResolvedValue(response);

        const { loadPaymentMethodOptions, paymentMethodOptions } = usePaymentMethodOptions();

        expect(paymentMethodOptions.value).toEqual([]);

        await loadPaymentMethodOptions({ subscriptionId, country });

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(1);
        expect(mockGetPaymentMethodOptions).toHaveBeenCalledWith({
            subscriptionId,
            country,
        });
        expect(paymentMethodOptions.value).toEqual(response);
    });
});
