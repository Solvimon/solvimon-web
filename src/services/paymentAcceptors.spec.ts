import { createPaymentAcceptorsService } from './paymentAcceptors';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

describe('payment acceptors service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequest.mockResolvedValue({ id: 'paya_1' });
    });

    it("lists the customer's acceptors", async () => {
        await createPaymentAcceptorsService().getPaymentAcceptors({ customerId: 'cust_1' });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/payment-acceptors',
            query: { customer_id: 'cust_1' },
            isCollection: true,
        });
    });

    it('edits an acceptor in place', async () => {
        await createPaymentAcceptorsService().updatePaymentAcceptor({
            paymentAcceptorId: 'paya_1',
            payload: { name: 'Renamed' },
        });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/payment-acceptors/paya_1',
            data: { name: 'Renamed' },
            options: { method: 'PATCH' },
        });
    });

    it('deletes an acceptor', async () => {
        await createPaymentAcceptorsService().deletePaymentAcceptor({
            paymentAcceptorId: 'paya_1',
        });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/payment-acceptors/paya_1',
            options: { method: 'DELETE' },
        });
    });
});
