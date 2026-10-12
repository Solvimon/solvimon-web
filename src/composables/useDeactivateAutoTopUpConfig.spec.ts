import { useDeactivateAutoTopUpConfig } from './useDeactivateAutoTopUpConfig';

const { mockDeactivate, mockError } = vi.hoisted(() => ({
    mockDeactivate: vi.fn(),
    mockError: vi.fn(),
}));

vi.mock('@/services/autoTopUpConfigs', () => ({
    createAutoTopUpConfigsService: () => ({ deactivateAutoTopUpConfig: mockDeactivate }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: mockError }),
}));

describe('useDeactivateAutoTopUpConfig', () => {
    beforeEach(() => {
        mockDeactivate.mockReset();
        mockDeactivate.mockResolvedValue({ id: 'atuc_1', status: 'INACTIVE' });
        mockError.mockReset();
    });

    it('turns the rule off and reports that it is off', async () => {
        const { deactivate } = useDeactivateAutoTopUpConfig();

        await expect(deactivate('atuc_1')).resolves.toBe(true);
        expect(mockDeactivate).toHaveBeenCalledWith('atuc_1');
    });

    it('logs a rule that would not turn off and reports it, rather than raising', async () => {
        const failure = new Error('nope');
        mockDeactivate.mockRejectedValue(failure);
        const { deactivate } = useDeactivateAutoTopUpConfig();

        await expect(deactivate('atuc_1')).resolves.toBe(false);
        expect(mockError).toHaveBeenCalledWith(
            'AUTO_TOP_UP_CANCELLATION_FAILED',
            expect.any(String),
            {},
            failure,
        );
    });

    it('sends nothing for a rule that was never saved', async () => {
        const { deactivate } = useDeactivateAutoTopUpConfig();

        await expect(deactivate(undefined)).resolves.toBe(false);
        expect(mockDeactivate).not.toHaveBeenCalled();
    });

    it('shows the request while it is out', async () => {
        let settle = () => {};
        mockDeactivate.mockReturnValue(new Promise<void>((resolve) => (settle = resolve)));
        const { deactivate, isDeactivating } = useDeactivateAutoTopUpConfig();

        const pending = deactivate('atuc_1');
        expect(isDeactivating.value).toBe(true);

        settle();
        await pending;

        expect(isDeactivating.value).toBe(false);
    });

    it('refuses a second request while one is still out', async () => {
        mockDeactivate.mockReturnValue(new Promise(() => {}));
        const { deactivate } = useDeactivateAutoTopUpConfig();

        void deactivate('atuc_1');

        await expect(deactivate('atuc_1')).resolves.toBe(false);
        expect(mockDeactivate).toHaveBeenCalledTimes(1);
    });
});
