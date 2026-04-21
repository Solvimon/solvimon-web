import { ApiStatus } from '@solvimon/types';
import { useService } from './useService';

describe('useService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the initial state', () => {
        const service = vi.fn().mockResolvedValue({ id: 'inv_1' });
        const { data, error, isPending, apiStatus } = useService({
            initialValue: null as { id: string } | null,
            service,
        });

        expect(data.value).toBeNull();
        expect(error.value).toBeNull();
        expect(isPending.value).toBe(false);
        expect(apiStatus.value).toBe(ApiStatus.Initial);
    });

    it('stores the raw response for non-collection services', async () => {
        const service = vi.fn().mockResolvedValue({ id: 'inv_1' });
        const { data, fetch, apiStatus, isPending } = useService({
            initialValue: null as { id: string } | null,
            service,
        });

        const promise = fetch();

        expect(isPending.value).toBe(true);
        expect(apiStatus.value).toBe(ApiStatus.Loading);

        await expect(promise).resolves.toStrictEqual({ id: 'inv_1' });

        expect(service).toHaveBeenCalledTimes(1);
        expect(data.value).toStrictEqual({ id: 'inv_1' });
        expect(apiStatus.value).toBe(ApiStatus.Done);
        expect(isPending.value).toBe(false);
    });

    it('stores response.data for collection services', async () => {
        const service = vi.fn().mockResolvedValue({
            data: [{ id: 'pay_1' }],
        });
        const { data, fetch } = useService({
            initialValue: [] as Array<{ id: string }>,
            service,
            isCollection: true,
        });

        await expect(fetch()).resolves.toStrictEqual([{ id: 'pay_1' }]);

        expect(service).toHaveBeenCalledTimes(1);
        expect(data.value).toStrictEqual([{ id: 'pay_1' }]);
    });

    it('supports omitting initialValue', async () => {
        const service = vi.fn().mockResolvedValue({ id: 'customer_1' });
        const { data, fetch } = useService({
            service,
        });

        expect(data.value).toBeUndefined();

        await expect(fetch()).resolves.toStrictEqual({ id: 'customer_1' });

        expect(data.value).toStrictEqual({ id: 'customer_1' });
    });

    it('sets error and failed status when the service throws an Error', async () => {
        const service = vi.fn().mockRejectedValue(new Error('Network error'));
        const { error, fetch, apiStatus, isPending } = useService({
            initialValue: null as { id: string } | null,
            service,
        });

        await expect(fetch()).rejects.toBeUndefined();

        expect(error.value).toStrictEqual(new Error('Network error'));
        expect(apiStatus.value).toBe(ApiStatus.Failed);
        expect(isPending.value).toBe(false);
    });

    it('normalizes non-Error throws into an Error instance', async () => {
        const service = vi.fn().mockRejectedValue('boom');
        const { error, fetch } = useService({
            service,
        });

        await expect(fetch()).rejects.toBeUndefined();

        expect(error.value).toBeInstanceOf(Error);
        expect(error.value?.message).toBe('Something went wrong while fetching data.');
    });
});
