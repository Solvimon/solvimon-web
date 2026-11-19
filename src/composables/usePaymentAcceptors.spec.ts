import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import { usePaymentAcceptors } from './usePaymentAcceptors';

const { mockService, mockLoggerError } = vi.hoisted(() => ({
    mockService: {
        getPaymentAcceptors: vi.fn(),
        createPaymentAcceptor: vi.fn(),
        updatePaymentAcceptor: vi.fn(),
        deletePaymentAcceptor: vi.fn(),
    },
    mockLoggerError: vi.fn(),
}));

vi.mock('@/services/paymentAcceptors', () => ({
    createPaymentAcceptorsService: () => mockService,
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

const acceptor = (overrides: Partial<PaymentAcceptor> = {}) =>
    ({
        id: 'paya_1',
        object_type: 'PAYMENT_ACCEPTOR',
        reference: 'ref_1',
        name: 'Main account',
        status: 'ACTIVE',
        type: 'BANK_ACCOUNT',
        ...overrides,
    }) as PaymentAcceptor;

const details = {
    name: 'Main account',
    type: 'BANK_ACCOUNT' as const,
    bank_account: { type: 'IBAN' as const, iban: 'NL91ABNA0417164300', country: 'NL' },
};

describe('usePaymentAcceptors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockService.getPaymentAcceptors.mockResolvedValue({ data: [] });
    });

    it('lists the active acceptors before the inactive ones', async () => {
        mockService.getPaymentAcceptors.mockResolvedValue({
            data: [
                acceptor({ id: 'paya_archived', status: 'ARCHIVED' }),
                acceptor({ id: 'paya_active' }),
            ],
        });
        const { items, fetchAll } = usePaymentAcceptors({ customerId: 'cust_1' });

        await fetchAll();

        expect(items.value.map(({ id }) => id)).toEqual(['paya_active', 'paya_archived']);
        expect(mockService.getPaymentAcceptors).toHaveBeenCalledWith({ customerId: 'cust_1' });
    });

    it('loads nothing without a customer', async () => {
        const { fetchAll } = usePaymentAcceptors({ customerId: undefined });

        await fetchAll();

        expect(mockService.getPaymentAcceptors).not.toHaveBeenCalled();
    });

    it('keeps a failed load as the error and logs it', async () => {
        const failure = new Error('down');
        mockService.getPaymentAcceptors.mockRejectedValue(failure);
        const { error, fetchAll } = usePaymentAcceptors({ customerId: 'cust_1' });

        await fetchAll();

        expect(error.value).toBe(failure);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'PAYMENT_ACCEPTORS_LOAD_FAILED',
            expect.any(String),
            {},
            failure,
        );
    });

    it('stores a new acceptor for the customer, leaving the reference to the portal, and reloads', async () => {
        mockService.createPaymentAcceptor.mockResolvedValue(acceptor());
        const { create } = usePaymentAcceptors({ customerId: 'cust_1' });

        await create(details);

        expect(mockService.createPaymentAcceptor).toHaveBeenCalledWith({
            ...details,
            customer_id: 'cust_1',
        });
        expect(mockService.getPaymentAcceptors).toHaveBeenCalled();
    });

    it('reloads after a failed create and passes the error on', async () => {
        const failure = new Error('down');
        mockService.createPaymentAcceptor.mockRejectedValue(failure);
        const { create } = usePaymentAcceptors({ customerId: 'cust_1' });

        await expect(create(details)).rejects.toBe(failure);
        expect(mockService.getPaymentAcceptors).toHaveBeenCalled();
    });

    it('updates and deletes by id, reloading after each', async () => {
        mockService.updatePaymentAcceptor.mockResolvedValue(acceptor());
        const { update, remove } = usePaymentAcceptors({ customerId: 'cust_1' });

        await update(acceptor(), { name: 'Renamed' });
        await remove(acceptor());

        expect(mockService.updatePaymentAcceptor).toHaveBeenCalledWith({
            paymentAcceptorId: 'paya_1',
            payload: { name: 'Renamed' },
        });
        expect(mockService.deletePaymentAcceptor).toHaveBeenCalledWith({
            paymentAcceptorId: 'paya_1',
        });
        expect(mockService.getPaymentAcceptors).toHaveBeenCalledTimes(2);
    });
});
