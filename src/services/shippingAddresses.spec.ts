import { createShippingAddressesService } from './shippingAddresses';
import type { CreateShippingAddressPayload } from '@/types/shippingAddress';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

describe('shipping addresses service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequest.mockResolvedValue({ id: 'shad_1' });
    });

    it("lists the customer's active addresses in one page", async () => {
        const { getShippingAddresses } = createShippingAddressesService();
        await getShippingAddresses({ customerId: 'cust_1' });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/shipping-addresses',
            query: { customer_id: 'cust_1', statuses: ['ACTIVE'], page: '1', limit: 50 },
            isCollection: true,
        });
    });

    it('creates an address for the customer', async () => {
        const payload = {
            customer_id: 'cust_1',
            reference: 'ref_1',
        } as unknown as CreateShippingAddressPayload;
        const { createShippingAddress } = createShippingAddressesService();
        await createShippingAddress(payload);

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/shipping-addresses',
            data: payload,
            options: { method: 'POST' },
        });
    });

    it('deletes an address by retiring it', async () => {
        const { deleteShippingAddress } = createShippingAddressesService();
        await deleteShippingAddress({ shippingAddressId: 'shad_1' });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/shipping-addresses/shad_1/deprecate',
            options: { method: 'POST' },
        });
    });
});
