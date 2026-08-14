import type { PaymentMethod } from '@solvimon/solvimon-types';
import { usePaymentMethod } from './usePaymentMethod';

const { mockGetPaymentMethods } = vi.hoisted(() => ({
    mockGetPaymentMethods: vi.fn(),
}));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({ getPaymentMethods: mockGetPaymentMethods }),
}));

const createPaymentMethod = (id: string, lastFour: string) =>
    ({
        id,
        type: 'CARD',
        status: 'ACTIVE',
        card: { brand: 'MASTERCARD', last_four_digits: lastFour },
    }) as unknown as PaymentMethod;

/** A collection response as the API returns it; `next` is what makes the caller ask for one more. */
const createPage = (data: PaymentMethod[], { hasNext = false } = {}) => ({
    data,
    page: 1,
    limit: 50,
    links: { current: 'current', ...(hasNext && { next: 'next' }) },
});

const visa = createPaymentMethod('pmet_visa', '1111');
const mastercard = createPaymentMethod('pmet_mastercard', '4242');

describe('usePaymentMethod', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPaymentMethods.mockResolvedValue(createPage([visa, mastercard]));
    });

    it('starts without a payment method', () => {
        const { paymentMethod } = usePaymentMethod();

        expect(paymentMethod.value).toBeUndefined();
    });

    it('picks the customer’s method with the given id', async () => {
        const { paymentMethod, get } = usePaymentMethod();

        const result = await get({
            customerId: 'cust_1',
            paymentMethodId: 'pmet_mastercard',
        });

        expect(result).toBe(mastercard);
        expect(paymentMethod.value).toBe(mastercard);
    });

    it('asks for the given customer’s methods', async () => {
        const { get } = usePaymentMethod();

        await get({ customerId: 'cust_1', paymentMethodId: 'pmet_visa' });

        expect(mockGetPaymentMethods).toHaveBeenCalledWith({
            customerId: 'cust_1',
            pagination: { page: 1, pageSize: 50 },
        });
    });

    // The whole reason the list is walked rather than the method fetched by id: a customer with
    // more methods than fit on a page would otherwise appear not to have the one being looked for.
    it('keeps paging until it has the whole list', async () => {
        mockGetPaymentMethods
            .mockResolvedValueOnce(createPage([visa], { hasNext: true }))
            .mockResolvedValueOnce(createPage([mastercard]));

        const { paymentMethod, get } = usePaymentMethod();

        const result = await get({
            customerId: 'cust_1',
            paymentMethodId: 'pmet_mastercard',
        });

        expect(mockGetPaymentMethods).toHaveBeenCalledTimes(2);
        expect(mockGetPaymentMethods).toHaveBeenLastCalledWith({
            customerId: 'cust_1',
            pagination: { page: 2, pageSize: 50 },
        });
        expect(result).toBe(mastercard);
        expect(paymentMethod.value).toBe(mastercard);
    });

    it('comes back empty when the customer has no method with that id', async () => {
        const { paymentMethod, get } = usePaymentMethod();

        const result = await get({ customerId: 'cust_1', paymentMethodId: 'pmet_unknown' });

        expect(result).toBeUndefined();
        expect(paymentMethod.value).toBeUndefined();
    });

    it('replaces what it found last time', async () => {
        const { paymentMethod, get } = usePaymentMethod();

        await get({ customerId: 'cust_1', paymentMethodId: 'pmet_mastercard' });
        expect(paymentMethod.value).toBe(mastercard);

        await get({ customerId: 'cust_1', paymentMethodId: 'pmet_visa' });
        expect(paymentMethod.value).toBe(visa);
    });

    it('rejects when the list cannot be loaded', async () => {
        mockGetPaymentMethods.mockResolvedValue({ message: 'Something went wrong' });

        const { paymentMethod, get } = usePaymentMethod();

        await expect(
            get({ customerId: 'cust_1', paymentMethodId: 'pmet_visa' }),
        ).rejects.toThrowError('Could not load the customer’s payment methods.');
        expect(paymentMethod.value).toBeUndefined();
    });

    it('lets a rejected request from the service through', async () => {
        mockGetPaymentMethods.mockRejectedValue(new Error('Network down'));

        const { get } = usePaymentMethod();

        await expect(
            get({ customerId: 'cust_1', paymentMethodId: 'pmet_visa' }),
        ).rejects.toThrowError('Network down');
    });
});
