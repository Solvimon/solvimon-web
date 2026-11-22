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
        mockRequest.mockResolvedValue({ data: [] });
        await createPaymentAcceptorsService().getPaymentAcceptors({ customerId: 'cust_1' });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/payment-acceptors',
            query: { customer_id: 'cust_1' },
            isCollection: true,
        });
    });

    it('leaves out the acceptors the customer deleted', async () => {
        mockRequest.mockResolvedValue({
            data: [
                { id: 'paya_1', status: 'ACTIVE' },
                { id: 'paya_2', status: 'ARCHIVED' },
                { id: 'paya_3', status: 'DEPRECATED' },
            ],
        });

        const { data } = await createPaymentAcceptorsService().getPaymentAcceptors({
            customerId: 'cust_1',
        });

        expect(data.map(({ id }) => id)).toEqual(['paya_1', 'paya_3']);
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

    it('deletes an acceptor by archiving it', async () => {
        await createPaymentAcceptorsService().archivePaymentAcceptor({
            paymentAcceptorId: 'paya_1',
        });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/payment-acceptors/paya_1',
            data: { status: 'ARCHIVED' },
            options: { method: 'PATCH' },
        });
    });
});
