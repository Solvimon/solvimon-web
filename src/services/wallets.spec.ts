import { createWalletsService } from './wallets';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://config.test' } }),
}));

describe('wallets service', () => {
    beforeEach(() => vi.clearAllMocks());

    it("asks for the balances of the customer's wallets, expanded", async () => {
        await createWalletsService().getCustomerWalletBalances('cus_1');

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://config.test/portal/customers/cus_1/wallets/balance',
            query: { expand: ['ALL'] },
            options: { method: 'POST' },
            data: {},
        });
    });

    it('encodes the customer id as one path segment', async () => {
        await createWalletsService().getCustomerWalletBalances('cus/../1');

        expect(mockRequest.mock.calls[0][0].url).toBe(
            'https://config.test/portal/customers/cus%2F..%2F1/wallets/balance',
        );
    });
});
