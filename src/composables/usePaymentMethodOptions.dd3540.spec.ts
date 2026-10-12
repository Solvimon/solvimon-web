import { ApiStatus, type PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import type { GetPaymentMethodOptionsPayload } from '@/services/paymentMethods.types';
import { usePaymentMethodOptions } from './usePaymentMethodOptions';

/**
 * DD-3540 tester: a lookup that lands after the caller moved on is not shown, but it still
 * replaces what is held, so the options on screen are no longer the ones held.
 */

const mockGetPaymentMethodOptions =
    vi.fn<(payload: GetPaymentMethodOptionsPayload) => Promise<PaymentMethodOptionsResponse>>();

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: vi.fn(() => ({
        getPaymentMethodOptions: mockGetPaymentMethodOptions,
    })),
}));

const US = { customerId: 'cust_123', country: 'US' } as const;
const DE = { customerId: 'cust_123', country: 'DE' } as const;

const optionsFor = (country: string) =>
    [{ id: `pm_${country}` }] as unknown as PaymentMethodOptionsResponse;

describe('DD-3540 tester: usePaymentMethodOptions holding a superseded answer', () => {
    beforeEach(() => {
        mockGetPaymentMethodOptions.mockReset();
    });

    it('answers the payload on screen from what is held after a late answer for another', async () => {
        const pending: ((value: PaymentMethodOptionsResponse) => void)[] = [];
        mockGetPaymentMethodOptions.mockImplementation(
            () => new Promise((resolve) => pending.push(resolve)),
        );
        const options = usePaymentMethodOptions();

        const us = options.get(US);
        const de = options.get(DE);
        pending[1]!(optionsFor('DE'));
        await de;
        pending[0]!(optionsFor('US'));
        await us;

        expect(options.paymentMethodOptions.value).toEqual(optionsFor('DE'));

        void options.get(DE);

        expect(options.apiStatus.value).toBe(ApiStatus.Done);
        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(2);
    });
});
