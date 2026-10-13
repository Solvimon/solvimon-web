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

const NL = { customerId: 'cust_123', country: 'NL' } as const;
const US = { customerId: 'cust_123', country: 'US' } as const;
const DE = { customerId: 'cust_123', country: 'DE' } as const;

const optionsFor = (country: string) =>
    [{ id: `pm_${country}` }] as unknown as PaymentMethodOptionsResponse;

interface Deferred {
    resolve: (value: PaymentMethodOptionsResponse) => void;
    reject: (error: Error) => void;
}

function controlledLookups() {
    const pending: Deferred[] = [];
    mockGetPaymentMethodOptions.mockImplementation(
        () =>
            new Promise<PaymentMethodOptionsResponse>((resolve, reject) => {
                pending.push({ resolve, reject });
            }),
    );
    return pending;
}

const settled = (promise: Promise<unknown>) => promise.catch(() => undefined);

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

    it('scopes a customer lookup to a subscription when given one', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        mockGetPaymentMethodOptions.mockResolvedValue([]);

        await usePaymentMethodOptions().get({ customerId: 'cust_123', subscriptionId });

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledWith({
            customerId: 'cust_123',
            subscriptionId,
            amount: undefined,
            country: undefined,
        });
    });

    it('captures errors when fetching fails', async () => {
        const error = new Error('failed');
        const payload: GetPaymentMethodOptionsPayload = {
            customerId: 'cust_123',
            country: 'NL',
        };

        mockGetPaymentMethodOptions.mockRejectedValue(error);

        const paymentMethodOptions = usePaymentMethodOptions();

        await expect(paymentMethodOptions.get(payload)).rejects.toBeInstanceOf(Error);

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

    it('requests again after a failed lookup, so a retry is not answered from the cache', async () => {
        const payload: GetPaymentMethodOptionsPayload = { customerId: 'cust_123', country: 'NL' };
        const response = [{ id: 'pm_1' }] as unknown as PaymentMethodOptionsResponse;

        mockGetPaymentMethodOptions.mockRejectedValueOnce(new Error('failed'));
        mockGetPaymentMethodOptions.mockResolvedValueOnce(response);

        const paymentMethodOptions = usePaymentMethodOptions();

        await expect(paymentMethodOptions.get(payload)).rejects.toBeInstanceOf(Error);
        await paymentMethodOptions.get({ ...payload });

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(2);
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

    // Checkout disables its pay button while `error` is set. A failed lookup for another country,
    // followed by a return to one already held, used to answer from the cache and leave the failure
    // in place, so the error card stayed and "Try again" asked nothing.
    it('clears an earlier failure when a held payload is asked for again', async () => {
        const response = [{ id: 'pm_1' }] as unknown as PaymentMethodOptionsResponse;
        mockGetPaymentMethodOptions
            .mockResolvedValueOnce(response)
            .mockRejectedValueOnce(new Error('Boom'));

        const paymentMethodOptions = usePaymentMethodOptions();

        await paymentMethodOptions.get({ customerId: 'cust_123', country: 'NL' });
        await expect(
            paymentMethodOptions.get({ customerId: 'cust_123', country: 'US' }),
        ).rejects.toBeInstanceOf(Error);
        await paymentMethodOptions.get({ customerId: 'cust_123', country: 'NL' });

        expect(paymentMethodOptions.error.value).toBeNull();
    });

    it('asks again for a payload that failed', async () => {
        const response = [{ id: 'pm_1' }] as unknown as PaymentMethodOptionsResponse;
        mockGetPaymentMethodOptions
            .mockResolvedValueOnce(response)
            .mockRejectedValueOnce(new Error('Boom'))
            .mockResolvedValueOnce(response);

        const paymentMethodOptions = usePaymentMethodOptions();

        await paymentMethodOptions.get({ customerId: 'cust_123', country: 'NL' });
        await expect(
            paymentMethodOptions.get({ customerId: 'cust_123', country: 'US' }),
        ).rejects.toBeInstanceOf(Error);
        await paymentMethodOptions.get({ customerId: 'cust_123', country: 'US' });

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(3);
        expect(paymentMethodOptions.error.value).toBeNull();
    });

    it('drops a failure that lands after the caller went back to a held payload', async () => {
        const response = [{ id: 'pm_1' }] as unknown as PaymentMethodOptionsResponse;
        let failLookup: (error: Error) => void = () => {};
        mockGetPaymentMethodOptions
            .mockResolvedValueOnce(response)
            .mockReturnValueOnce(new Promise((_, reject) => (failLookup = reject)));

        const paymentMethodOptions = usePaymentMethodOptions();

        await paymentMethodOptions.get({ customerId: 'cust_123', country: 'NL' });
        const pendingUs = paymentMethodOptions.get({ customerId: 'cust_123', country: 'US' });
        await paymentMethodOptions.get({ customerId: 'cust_123', country: 'NL' });
        failLookup(new Error('Boom'));
        await expect(pendingUs).rejects.toBeInstanceOf(Error);

        expect(paymentMethodOptions.error.value).toBeNull();
        expect(paymentMethodOptions.apiStatus.value).toBe(ApiStatus.Done);
        expect(paymentMethodOptions.paymentMethodOptions.value).toEqual(response);
    });
});

describe('usePaymentMethodOptions, lookups settling out of order', () => {
    beforeEach(() => {
        mockGetPaymentMethodOptions.mockReset();
    });

    it('keeps the options of the payload returned to when a slow lookup for another succeeds', async () => {
        const lookups = controlledLookups();
        const options = usePaymentMethodOptions();

        const nl = options.get(NL);
        lookups[0]!.resolve(optionsFor('NL'));
        await nl;

        const us = options.get(US);
        await options.get(NL);
        lookups[1]!.resolve(optionsFor('US'));
        await settled(us);

        expect(options.paymentMethodOptions.value).toEqual(optionsFor('NL'));
    });

    it('shows no failure once the payload asked for last has loaded', async () => {
        const lookups = controlledLookups();
        const options = usePaymentMethodOptions();

        const nl = options.get(NL);
        lookups[0]!.resolve(optionsFor('NL'));
        await nl;

        const us = options.get(US);
        const de = options.get(DE);
        lookups[1]!.reject(new Error('US failed'));
        await settled(us);
        lookups[2]!.resolve(optionsFor('DE'));
        await de;

        expect(options.paymentMethodOptions.value).toEqual(optionsFor('DE'));
        expect(options.error.value).toBeNull();
    });

    it('settles a rapid A→B→A→B on B with one lookup for B', async () => {
        const lookups = controlledLookups();
        const options = usePaymentMethodOptions();

        const nl = options.get(NL);
        lookups[0]!.resolve(optionsFor('NL'));
        await nl;

        const first = options.get(US);
        await options.get(NL);
        const second = options.get(US);
        lookups[1]!.resolve(optionsFor('US'));
        await Promise.all([first, second]);

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(2);
        expect(options.paymentMethodOptions.value).toEqual(optionsFor('US'));
        expect(options.error.value).toBeNull();
    });

    it('reports the failure of B after a rapid A→B→A→B, since B is where the caller is', async () => {
        const lookups = controlledLookups();
        const options = usePaymentMethodOptions();

        const nl = options.get(NL);
        lookups[0]!.resolve(optionsFor('NL'));
        await nl;

        const first = options.get(US);
        await options.get(NL);
        const second = options.get(US);
        lookups[1]!.reject(new Error('US failed'));
        await Promise.all([settled(first), settled(second)]);

        expect(options.error.value).not.toBeNull();
    });

    it('joins a retry asked while the retried lookup is still in flight', async () => {
        const lookups = controlledLookups();
        const options = usePaymentMethodOptions();

        const failed = options.get(NL);
        lookups[0]!.reject(new Error('NL failed'));
        await settled(failed);
        expect(options.error.value).not.toBeNull();

        const retry = options.get({ ...NL });
        const secondRetry = options.get({ ...NL });
        lookups[1]!.resolve(optionsFor('NL'));
        await Promise.all([retry, secondRetry]);

        expect(mockGetPaymentMethodOptions).toHaveBeenCalledTimes(2);
        expect(options.error.value).toBeNull();
        expect(options.paymentMethodOptions.value).toEqual(optionsFor('NL'));
    });
});

describe('usePaymentMethodOptions after a superseded lookup lands', () => {
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
