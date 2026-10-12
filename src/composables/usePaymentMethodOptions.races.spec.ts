import type { PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import type { GetPaymentMethodOptionsPayload } from '@/services/paymentMethods.types';
import { usePaymentMethodOptions } from './usePaymentMethodOptions';

/**
 * DD-3537 tester, round 2: the order lookups settle in is not the order they were asked in.
 * Whatever lands last, what is held and what is shown must belong to the payload asked for last.
 */

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

/** Answers each lookup only when the test says so. */
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
