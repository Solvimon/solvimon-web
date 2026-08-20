import { useSaveAutoTopUpConfig } from './useSaveAutoTopUpConfig';
import type { WalletAutoTopUpConfigPayload } from '@solvimon/solvimon-types';

const { mockCreate, mockError } = vi.hoisted(() => ({ mockCreate: vi.fn(), mockError: vi.fn() }));

vi.mock('@/services/autoTopUpConfigs', () => ({
    createAutoTopUpConfigsService: () => ({ createAutoTopUpConfig: mockCreate }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: mockError }),
}));

const payload = {
    wallet_id: 'wall_1',
    status: 'ACTIVE',
    threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
    pricing_plan_schedule_id: 'ppsc_1',
    pricing_item_id: 'prii_1',
    payment_method_id: 'pmet_1',
} as WalletAutoTopUpConfigPayload;

describe('useSaveAutoTopUpConfig', () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockCreate.mockResolvedValue({ id: 'atuc_1' });
        mockError.mockReset();
    });

    it('sends the rule and reports that it landed', async () => {
        const { save } = useSaveAutoTopUpConfig();

        await expect(save(payload)).resolves.toEqual({ saved: true });
        expect(mockCreate).toHaveBeenCalledWith(payload);
    });

    it('reports a rule that would not save, rather than raising', async () => {
        mockCreate.mockRejectedValue(new Error('nope'));
        const { save } = useSaveAutoTopUpConfig();

        await expect(save(payload)).resolves.toEqual({ saved: false, error: expect.any(Error) });
        expect(mockError).toHaveBeenCalledWith(
            'AUTO_TOP_UP_SAVE_FAILED',
            expect.any(String),
            {},
            expect.any(Error),
        );
    });

    it('sends nothing for a rule that is not ready', async () => {
        const { save } = useSaveAutoTopUpConfig();

        await expect(save(undefined)).resolves.toEqual({ saved: false });
        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockError).not.toHaveBeenCalled();
    });

    it('shows the request while it is out', async () => {
        let settle = () => {};
        mockCreate.mockReturnValue(new Promise<void>((resolve) => (settle = resolve)));
        const { save, isSaving } = useSaveAutoTopUpConfig();

        const pending = save(payload);
        expect(isSaving.value).toBe(true);

        settle();
        await pending;

        expect(isSaving.value).toBe(false);
    });

    it('refuses a second save while one is still out', async () => {
        mockCreate.mockReturnValue(new Promise(() => {}));
        const { save } = useSaveAutoTopUpConfig();

        void save(payload);

        await expect(save(payload)).resolves.toEqual({ saved: false });
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });
});
