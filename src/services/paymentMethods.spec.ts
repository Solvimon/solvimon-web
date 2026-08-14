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

            const { url, isCollection } = mockRequest.mock.calls[0][0];

            expect(isCollection).toBe(true);
            expect(url).toContain('customer_id=cust_1');
            expect(url).toContain('page=2');
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
});
