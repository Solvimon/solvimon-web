import { ApiStatus } from '@solvimon/solvimon-types';
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
        const { data, execute, apiStatus, isPending } = useService({
            initialValue: null as { id: string } | null,
            service,
        });

        const promise = execute();

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
        const { data, execute } = useService({
            initialValue: [] as Array<{ id: string }>,
            service,
            isCollection: true,
        });

        await expect(execute()).resolves.toStrictEqual([{ id: 'pay_1' }]);

        expect(service).toHaveBeenCalledTimes(1);
        expect(data.value).toStrictEqual([{ id: 'pay_1' }]);
    });

    it('supports omitting initialValue', async () => {
        const service = vi.fn().mockResolvedValue({ id: 'customer_1' });
        const { data, execute } = useService({
            service,
        });

        expect(data.value).toBeUndefined();

        await expect(execute()).resolves.toStrictEqual({ id: 'customer_1' });

        expect(data.value).toStrictEqual({ id: 'customer_1' });
    });

    it('sets error and failed status when the service throws an Error', async () => {
        const service = vi.fn().mockRejectedValue(new Error('Network error'));
        const { error, execute, apiStatus, isPending } = useService({
            initialValue: null as { id: string } | null,
            service,
        });

        await expect(execute()).rejects.toBeUndefined();

        expect(error.value).toStrictEqual(new Error('Network error'));
        expect(apiStatus.value).toBe(ApiStatus.Failed);
        expect(isPending.value).toBe(false);
    });

    it('normalizes non-Error throws into an Error instance', async () => {
        const service = vi.fn().mockRejectedValue('boom');
        const { error, execute } = useService({
            service,
        });

        await expect(execute()).rejects.toBeUndefined();

        expect(error.value).toBeInstanceOf(Error);
        expect(error.value?.message).toBe('Something went wrong while fetching data.');
    });

    describe('requests answering out of order', () => {
        function controlled() {
            const pending: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];
            const service = vi.fn(
                () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
            );
            return { pending, service };
        }

        it('keeps the answer to the request asked last', async () => {
            const { pending, service } = controlled();
            const { data, execute, apiStatus } = useService({ service });

            const first = execute();
            const second = execute();
            pending[1]!.resolve('second');
            await second;
            pending[0]!.resolve('first');

            await expect(first).resolves.toBe('first');
            expect(data.value).toBe('second');
            expect(apiStatus.value).toBe(ApiStatus.Done);
        });

        it('stays pending until the request asked last answers', async () => {
            const { pending, service } = controlled();
            const { execute, isPending } = useService({ service });

            const first = execute();
            const second = execute();
            pending[0]!.resolve('first');
            await first;

            expect(isPending.value).toBe(true);
            pending[1]!.resolve('second');
            await second;
            expect(isPending.value).toBe(false);
        });

        it('drops the failure of a request asked before the last', async () => {
            const { pending, service } = controlled();
            const { data, execute, error, apiStatus } = useService({ service });

            const first = execute();
            const second = execute();
            pending[0]!.reject(new Error('first failed'));
            await expect(first).rejects.toBeUndefined();
            pending[1]!.resolve('second');
            await second;

            expect(error.value).toBeNull();
            expect(data.value).toBe('second');
            expect(apiStatus.value).toBe(ApiStatus.Done);
        });

        it('lets a settled value supersede a request still out', async () => {
            const { pending, service } = controlled();
            const { data, execute, settle, error, apiStatus } = useService({ service });

            const first = execute();
            settle('held');
            pending[0]!.reject(new Error('first failed'));
            await expect(first).rejects.toBeUndefined();

            expect(data.value).toBe('held');
            expect(error.value).toBeNull();
            expect(apiStatus.value).toBe(ApiStatus.Done);
        });
    });
});
