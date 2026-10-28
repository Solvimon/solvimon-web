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

    it('edits an address in place', async () => {
        const payload = {
            customer_id: 'cust_1',
            reference: 'ref_1',
        } as unknown as CreateShippingAddressPayload;
        const { updateShippingAddress } = createShippingAddressesService();
        await updateShippingAddress({ shippingAddressId: 'shad_1', payload });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/shipping-addresses/shad_1',
            data: payload,
            options: { method: 'PATCH' },
        });
    });
});
