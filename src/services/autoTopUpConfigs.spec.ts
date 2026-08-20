import type { WalletAutoTopUpConfig } from '@solvimon/solvimon-types';
import { createAutoTopUpConfigsService } from './autoTopUpConfigs';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

const config = { id: 'atuc_1', status: 'ACTIVE' } as WalletAutoTopUpConfig;

describe('autoTopUpConfigs service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAutoTopUpConfigs', () => {
        it('asks for the configs on the given wallet', async () => {
            mockRequest.mockResolvedValue({ data: [config], links: { current: 'current' } });

            const { getAutoTopUpConfigs } = createAutoTopUpConfigsService();
            await getAutoTopUpConfigs({ wallet_id: 'wlt_1' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/auto-top-up-configs',
                query: { wallet_id: 'wlt_1' },
                isCollection: true,
            });
        });

        it('leaves the schedule filter off when none is given', async () => {
            mockRequest.mockResolvedValue({ data: [], links: { current: 'current' } });

            const { getAutoTopUpConfigs } = createAutoTopUpConfigsService();
            await getAutoTopUpConfigs({ wallet_id: 'wlt_1' });

            // Sending an empty filter would narrow the list to configs on no schedule at all.
            expect(mockRequest.mock.calls[0][0].query).not.toHaveProperty(
                'pricing_plan_schedule_id',
            );
        });

        it('narrows to a schedule when one is given', async () => {
            mockRequest.mockResolvedValue({ data: [], links: { current: 'current' } });

            const { getAutoTopUpConfigs } = createAutoTopUpConfigsService();
            await getAutoTopUpConfigs({ wallet_id: 'wlt_1', pricing_plan_schedule_id: 'pps_1' });

            expect(mockRequest.mock.calls[0][0].query).toEqual({
                wallet_id: 'wlt_1',
                pricing_plan_schedule_id: 'pps_1',
            });
        });
    });

    describe('getAutoTopUpConfig', () => {
        it('reads the config by id', async () => {
            mockRequest.mockResolvedValue(config);

            const { getAutoTopUpConfig } = createAutoTopUpConfigsService();
            const response = await getAutoTopUpConfig('atuc_1');

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/auto-top-up-configs/atuc_1',
            });
            expect(response).toBe(config);
        });
    });

    describe('createAutoTopUpConfig', () => {
        it('posts the config in the shape the API takes', async () => {
            mockRequest.mockResolvedValue(config);

            const { createAutoTopUpConfig } = createAutoTopUpConfigsService();
            await createAutoTopUpConfig({
                wallet_id: 'wlt_1',
                status: 'ACTIVE',
                threshold: { amount: { quantity: '10', currency: 'EUR' } },
                pricing_plan_schedule_id: 'pps_1',
                pricing_item_id: 'pitm_1',
                payment_method_id: 'pmet_1',
            });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/auto-top-up-configs',
                options: { method: 'POST' },
                data: {
                    wallet_id: 'wlt_1',
                    status: 'ACTIVE',
                    threshold: { amount: { quantity: '10', currency: 'EUR' } },
                    pricing_plan_schedule_id: 'pps_1',
                    pricing_item_id: 'pitm_1',
                    payment_method_id: 'pmet_1',
                },
            });
        });

        it('sends a credits threshold through untouched', async () => {
            mockRequest.mockResolvedValue(config);

            const { createAutoTopUpConfig } = createAutoTopUpConfigsService();
            await createAutoTopUpConfig({
                wallet_id: 'wlt_1',
                status: 'ACTIVE',
                threshold: { credits: { quantity: '500', credit_type_id: 'crty_1' } },
                pricing_plan_schedule_id: 'pps_1',
                pricing_item_id: 'pitm_1',
                payment_method_id: 'pmet_1',
            });

            expect(mockRequest.mock.calls[0][0].data.threshold).toEqual({
                credits: { quantity: '500', credit_type_id: 'crty_1' },
            });
        });
    });

    describe('deactivateAutoTopUpConfig', () => {
        it('posts to the deactivate action rather than deleting the config', async () => {
            mockRequest.mockResolvedValue({ ...config, status: 'INACTIVE' });

            const { deactivateAutoTopUpConfig } = createAutoTopUpConfigsService();
            const response = await deactivateAutoTopUpConfig('atuc_1');

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/auto-top-up-configs/atuc_1/deactivate',
                options: { method: 'POST' },
            });
            expect(response.status).toBe('INACTIVE');
        });
    });
});
