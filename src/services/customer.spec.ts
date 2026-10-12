import type { Customer } from '@solvimon/solvimon-types';
import { createCustomerService } from './customer';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

const customer = { id: 'cust_1' } as Customer;

describe('customer service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getCustomer', () => {
        it('reads the customer by id', async () => {
            mockRequest.mockResolvedValue(customer);

            const { getCustomer } = createCustomerService();
            const response = await getCustomer('cust_1');

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/customers/cust_1',
            });
            expect(response).toBe(customer);
        });
    });

    describe('updateCustomer', () => {
        it('patches only the fields it is given', async () => {
            mockRequest.mockResolvedValue(customer);
            const payload = { email: 'billing@example.com' } as Partial<Customer>;

            const { updateCustomer } = createCustomerService();
            const response = await updateCustomer('cust_1', payload);

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/customers/cust_1',
                options: { method: 'PATCH' },
                data: payload,
            });
            expect(response).toBe(customer);
        });

        it('passes a failed update on to the caller', async () => {
            const error = new Error('invalid');
            mockRequest.mockRejectedValue(error);

            const { updateCustomer } = createCustomerService();

            await expect(updateCustomer('cust_1', {})).rejects.toBe(error);
        });
    });

    describe('checkTaxID', () => {
        it('posts the organisation to the validate-tax-id action', async () => {
            const validation = { data: [{ valid: true }] };
            mockRequest.mockResolvedValue(validation);
            const payload = {
                type: 'ORGANIZATION',
                organization: {
                    legal_name: 'Acme B.V.',
                    tax_ids: [{ type: 'EU_VAT', id: 'NL123456789B01' }],
                    registered_address: { country: 'NL' },
                },
            } as Parameters<ReturnType<typeof createCustomerService>['checkTaxID']>[0];

            const { checkTaxID } = createCustomerService();
            const response = await checkTaxID(payload);

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/customers/validate-tax-id',
                options: { method: 'POST' },
                data: payload,
            });
            expect(response).toBe(validation);
        });
    });
});
