import type { Payment } from '@solvimon/solvimon-types';
import { createPaymentsService } from './payments';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { transaction: 'https://api.test' } }),
}));

type AuthorizePaymentData = Parameters<
    ReturnType<typeof createPaymentsService>['authorizePayment']
>[0];

describe('payments service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getPayments', () => {
        it('asks for the payments on the given invoice as a collection', async () => {
            const collection = {
                data: [{ id: 'pay_1' } as Payment],
                links: { current: 'current' },
            };
            mockRequest.mockResolvedValue(collection);

            const { getPayments } = createPaymentsService();
            const response = await getPayments('inv_1');

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/payments',
                query: { invoice_id: 'inv_1' },
                isCollection: true,
            });
            expect(response).toBe(collection);
        });
    });

    describe('getPaymentDetails', () => {
        it('posts the Adyen details to verify-details in the shape the API takes', async () => {
            const details = { status: 'AUTHORIZED' };
            mockRequest.mockResolvedValue(details);

            const { getPaymentDetails } = createPaymentsService();
            const response = await getPaymentDetails({
                paymentAcceptorId: 'pacc_1',
                paymentGatewayVariant: 'ADYEN',
                adyen: { redirect_result: 'redirect-result', details: { MD: 'md' } },
            });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/payments/verify-details',
                options: { method: 'POST' },
                data: {
                    payment_acceptor_id: 'pacc_1',
                    payment_gateway_variant: 'ADYEN',
                    adyen: { redirect_result: 'redirect-result', details: { MD: 'md' } },
                },
            });
            expect(response).toBe(details);
        });
    });

    describe('authorizePayment', () => {
        it('posts the payload to the authorize action untouched', async () => {
            const authorization = { status: 'AUTHORIZED' };
            mockRequest.mockResolvedValue(authorization);
            const payload = {
                payment_acceptor_id: 'pacc_1',
                invoice_id: 'inv_1',
            } as unknown as AuthorizePaymentData;

            const { authorizePayment } = createPaymentsService();
            const response = await authorizePayment(payload);

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/payments/authorize',
                options: { method: 'POST' },
                data: payload,
            });
            expect(response).toBe(authorization);
        });

        it('sends a charge-on-demand context along as given', async () => {
            mockRequest.mockResolvedValue({});
            const context = {
                type: 'CHARGE_ON_DEMAND',
                charge_on_demand: {
                    pricing_plan_schedule_id: 'pps_1',
                    pricing_items: [{ pricing_item_id: 'pitm_1' }],
                },
            } as const;

            const { authorizePayment } = createPaymentsService();
            await authorizePayment({
                payment_acceptor_id: 'pacc_1',
                context,
            } as unknown as AuthorizePaymentData);

            expect(mockRequest.mock.calls[0][0].data.context).toEqual(context);
        });

        it('passes a failed request on to the caller', async () => {
            const error = new Error('declined');
            mockRequest.mockRejectedValue(error);

            const { authorizePayment } = createPaymentsService();

            await expect(authorizePayment({} as AuthorizePaymentData)).rejects.toBe(error);
        });
    });
});
