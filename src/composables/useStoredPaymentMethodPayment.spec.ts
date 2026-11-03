import { useStoredPaymentMethodPayment } from './useStoredPaymentMethodPayment';
import { ApiError } from '@/services/apiError';

const { mockCharge, mockError } = vi.hoisted(() => ({
    mockCharge: vi.fn(),
    mockError: vi.fn(),
}));

vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({ chargeStoredPaymentMethod: mockCharge }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const payload = {
    paymentAcceptorId: 'paya_1',
    customerId: 'cust_1',
    paymentMethodId: 'pmet_1',
    invoiceId: 'invo_1',
    amount: { quantity: '99.00', currency: 'EUR' },
};

describe('useStoredPaymentMethodPayment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        [
            'an authorized payment',
            { status: 'SUCCESS', payment: { result: 'AUTHORIZED' } },
            'SUCCEEDED',
        ],
        [
            'a payment still pending',
            { status: 'SUCCESS', payment: { result: 'PENDING' } },
            'UNCONFIRMED',
        ],
        ['a refused payment', { status: 'SUCCESS', payment: { result: 'REFUSED' } }, 'FAILED'],
    ])('reads %s', async (_, response, outcome) => {
        mockCharge.mockResolvedValue(response);

        const { charge } = useStoredPaymentMethodPayment();

        expect(await charge(payload)).toBe(outcome);
        expect(mockCharge).toHaveBeenCalledWith(payload);
    });

    it('reports a charge the gateway declines as failed, and logs it', async () => {
        const declined = new ApiError({ statusCode: 400 });
        mockCharge.mockRejectedValue(declined);

        const { charge } = useStoredPaymentMethodPayment();

        expect(await charge(payload)).toBe('FAILED');
        expect(mockError).toHaveBeenCalledWith(
            'PAYMENT_AUTHORIZATION_FAILED',
            expect.any(String),
            expect.objectContaining({ invoiceId: 'invo_1', paymentAcceptorId: 'paya_1' }),
            declined,
        );
    });

    it('cannot tell a charge whose answer never arrived from one that went through', async () => {
        mockCharge.mockRejectedValue(new ApiError({ statusCode: 503 }));

        const { charge } = useStoredPaymentMethodPayment();

        expect(await charge(payload)).toBe('UNCONFIRMED');
    });

    it('sends one charge at a time', async () => {
        let resolve: (value: unknown) => void = () => {};
        mockCharge.mockReturnValue(new Promise((r) => (resolve = r)));

        const { charge, isPending } = useStoredPaymentMethodPayment();
        const first = charge(payload);
        const second = await charge(payload);

        expect(isPending.value).toBe(true);
        expect(second).toBe('UNCONFIRMED');
        expect(mockCharge).toHaveBeenCalledTimes(1);

        resolve({ status: 'SUCCESS', payment: { result: 'AUTHORIZED' } });
        expect(await first).toBe('SUCCEEDED');
        expect(isPending.value).toBe(false);
    });
});
