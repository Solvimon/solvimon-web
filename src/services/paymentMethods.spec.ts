import type { PaymentMethod } from '@solvimon/solvimon-types';
import { createPaymentMethodsService } from './paymentMethods';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

const createPaymentMethod = (id: string, status: PaymentMethod['status']) =>
    ({ id, status, type: 'CARD' }) as unknown as PaymentMethod;

const collection = (data: PaymentMethod[]) => ({
    data,
    page: 1,
    limit: 15,
    links: { current: 'current' },
});

describe('paymentMethods service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getPaymentMethods', () => {
        it('leaves archived methods out of the list', async () => {
            mockRequest.mockResolvedValue(
                collection([
                    createPaymentMethod('pmet_active', 'ACTIVE'),
                    createPaymentMethod('pmet_archived', 'ARCHIVED'),
                    createPaymentMethod('pmet_inactive', 'INACTIVE'),
                ]),
            );

            const { getPaymentMethods } = createPaymentMethodsService();
            const response = await getPaymentMethods({
                customerId: 'cust_1',
                pagination: { page: 1 },
            });

            expect(response.data.map(({ id }) => id)).toEqual(['pmet_active', 'pmet_inactive']);
        });

        it('keeps the rest of the collection response intact', async () => {
            mockRequest.mockResolvedValue({
                ...collection([createPaymentMethod('pmet_active', 'ACTIVE')]),
                links: { current: 'current', next: 'next' },
            });

            const { getPaymentMethods } = createPaymentMethodsService();
            const response = await getPaymentMethods({
                customerId: 'cust_1',
                pagination: { page: 1 },
            });

            // Paging has to survive the filter, or callers walking every page stop after the first.
            expect(response.links.next).toBe('next');
            expect(response.page).toBe(1);
        });

        it('asks the API for the given customer', async () => {
            mockRequest.mockResolvedValue(collection([]));

            const { getPaymentMethods } = createPaymentMethodsService();
            await getPaymentMethods({
                customerId: 'cust_1',
                pagination: { page: 2, pageSize: 15 },
            });

            const { url, query, isCollection } = mockRequest.mock.calls[0][0];

            expect(isCollection).toBe(true);
            expect(url).toBe('https://api.test/portal/payment-methods');
            expect(query).toMatchObject({ customer_id: 'cust_1', page: '2', limit: 15 });
        });
    });

    describe('archivePaymentMethod', () => {
        it('patches the method to ARCHIVED', async () => {
            mockRequest.mockResolvedValue({ id: 'pmet_1', status: 'ARCHIVED' });

            const { archivePaymentMethod } = createPaymentMethodsService();
            await archivePaymentMethod({ paymentMethodId: 'pmet_1' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/payment-methods/pmet_1',
                options: { method: 'PATCH' },
                data: { status: 'ARCHIVED' },
            });
        });
    });

    describe('getPaymentMethodOptions', () => {
        beforeEach(() => {
            mockRequest.mockResolvedValue([]);
        });

        // Without it the answer carries every acceptor the customer has, including ones this
        // invoice refuses, and paying through one of those fails with a 400 (DD-3533).
        it('names the invoice being paid, so the API answers for that invoice', async () => {
            const { getPaymentMethodOptions } = createPaymentMethodsService();
            await getPaymentMethodOptions({
                customerId: 'cust_1',
                invoiceId: 'invo_1',
                amount: { quantity: '20.00', currency: 'EUR' },
            });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/payment-method-options',
                options: { method: 'POST' },
                data: {
                    customer_id: 'cust_1',
                    invoice_id: 'invo_1',
                    amount: { quantity: '20.00', currency: 'EUR' },
                },
            });
        });

        it('leaves the invoice out when there is none to pay', async () => {
            const { getPaymentMethodOptions } = createPaymentMethodsService();
            await getPaymentMethodOptions({ customerId: 'cust_1' });

            expect(mockRequest.mock.calls[0][0].data).not.toHaveProperty('invoice_id');
        });

        it('scopes by subscription for a checkout instead', async () => {
            const { getPaymentMethodOptions } = createPaymentMethodsService();
            await getPaymentMethodOptions({ subscriptionId: 'ppsu_1', country: 'NL' });

            expect(mockRequest.mock.calls[0][0].data).toMatchObject({
                pricing_plan_subscription_id: 'ppsu_1',
                country: 'NL',
            });
        });
    });
});
