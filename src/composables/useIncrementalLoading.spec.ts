import { ApiStatus } from '@solvimon/solvimon-types';
import { useIncrementalLoading } from './useIncrementalLoading';

describe('useIncrementalLoading', () => {
    const createSuccessResponse = <T>(data: T[], page: number, hasNext = false) => ({
        data,
        page,
        limit: 10,
        links: {
            previous: undefined,
            current: `/items?page=${page}`,
            next: hasNext ? `/items?page=${page + 1}` : undefined,
        },
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns initial state with empty items when no initialData', () => {
        const service = vi.fn().mockResolvedValue(createSuccessResponse([], 1));
        const { items, error, isPending, hasNextBatch, fetchMore } = useIncrementalLoading({
            service,
        });

        expect(items.value).toEqual([]);
        expect(error.value).toBeNull();
        expect(isPending.value).toBe(false);
        expect(hasNextBatch.value).toBe(false);
        expect(typeof fetchMore).toBe('function');
    });

    it('returns initial state with initialData when provided', () => {
        const service = vi.fn().mockResolvedValue(createSuccessResponse([], 1));
        const initial = [{ id: 'a' }];
        const { items } = useIncrementalLoading<{ id: string }>({ initialData: initial, service });

        expect(items.value).toStrictEqual([{ id: 'a' }]);
    });

    it('fetchInitial calls service and appends response data to items', async () => {
        const page1Data = [{ id: '1' }, { id: '2' }];
        const service = vi.fn().mockResolvedValueOnce(createSuccessResponse(page1Data, 1, true));
        const { items, fetchInitial, isPending, hasNextBatch } = useIncrementalLoading<{
            id: string;
        }>({ service });

        expect(isPending.value).toBe(false);

        const promise = fetchInitial();
        expect(isPending.value).toBe(true);
        await promise;

        expect(service).toHaveBeenCalledTimes(1);
        expect(items.value).toStrictEqual([{ id: '1' }, { id: '2' }]);
        expect(hasNextBatch.value).toBe(true);
        expect(isPending.value).toBe(false);
    });

    it('fetchMore loads next page and appends to items', async () => {
        const page1Data = [{ id: '1' }];
        const page2Data = [{ id: '2' }, { id: '3' }];
        const service = vi
            .fn()
            .mockResolvedValueOnce(createSuccessResponse(page1Data, 1, true))
            .mockResolvedValueOnce(createSuccessResponse(page2Data, 2, false));

        const { items, fetchInitial, fetchMore } = useIncrementalLoading<{ id: string }>({
            service,
        });

        await fetchInitial();
        expect(items.value).toStrictEqual([{ id: '1' }]);

        await fetchMore();

        expect(service).toHaveBeenCalledTimes(2);
        expect(items.value).toStrictEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    });

    it('sets error and Failed status when service throws', async () => {
        const service = vi.fn().mockRejectedValue(new Error('Network error'));
        const { error, fetchInitial, isPending } = useIncrementalLoading({ service });

        await fetchInitial();

        expect(error.value).toStrictEqual(new Error('Network error'));
        expect(isPending.value).toBe(false);
    });

    it('does not update items when response is not a success collection', async () => {
        const service = vi.fn().mockResolvedValue({ message: 'Not found', hasError: true });
        const { items, fetchInitial } = useIncrementalLoading<{ id: string }>({
            initialData: [{ id: 'existing' }],
            service,
        });

        await fetchInitial();

        expect(items.value).toStrictEqual([{ id: 'existing' }]);
    });

    it('hands out a copy, so appending to it cannot reach the list paging reads from', async () => {
        const service = vi
            .fn()
            .mockResolvedValueOnce(createSuccessResponse([{ id: '1' }], 1, true))
            .mockResolvedValueOnce(createSuccessResponse([{ id: '2' }], 2));
        const { items, fetchInitial, fetchMore } = useIncrementalLoading<{ id: string }>({
            service,
        });

        await fetchInitial();
        items.value.push({ id: 'injected' });

        await fetchMore();

        expect(items.value).toStrictEqual([{ id: '1' }, { id: '2' }]);
    });

    it('fetchAll loads full list via getPaginatedFullList and replaces items', async () => {
        const fullData = [{ id: 'a' }, { id: 'b' }];
        const service = vi.fn().mockResolvedValue(createSuccessResponse(fullData, 1, false));
        const { items, fetchAll, isPending } = useIncrementalLoading<{ id: string }>({
            initialData: [{ id: 'initial' }],
            service,
        });

        await fetchAll();

        expect(service).toHaveBeenCalledTimes(1);
        expect(items.value).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
        expect(isPending.value).toBe(false);
    });

    it('does not load another page while one is pending', async () => {
        let resolveSecond: () => void;
        const secondPage = new Promise<ReturnType<typeof createSuccessResponse>>((resolve) => {
            resolveSecond = () => resolve(createSuccessResponse([{ id: '2' }], 2, true));
        });
        const service = vi
            .fn()
            .mockResolvedValueOnce(createSuccessResponse([{ id: '1' }], 1, true))
            .mockReturnValueOnce(secondPage);

        const { items, fetchInitial, fetchMore } = useIncrementalLoading<{ id: string }>({
            service,
        });

        await fetchInitial();

        const p1 = fetchMore();
        const p2 = fetchMore();

        resolveSecond!();
        await Promise.all([p1, p2]);

        expect(service).toHaveBeenCalledTimes(2);
        expect(items.value).toStrictEqual([{ id: '1' }, { id: '2' }]);
    });

    it('lets a refresh replace a page still loading instead of dropping it', async () => {
        let resolveStalePage: () => void;
        const stalePage = new Promise<ReturnType<typeof createSuccessResponse>>((resolve) => {
            resolveStalePage = () => resolve(createSuccessResponse([{ id: 'stale' }], 2));
        });
        const service = vi
            .fn()
            .mockResolvedValueOnce(createSuccessResponse([{ id: '1' }], 1, true))
            .mockReturnValueOnce(stalePage)
            .mockResolvedValueOnce(createSuccessResponse([{ id: 'fresh' }], 1, true));

        const { items, fetchInitial, fetchMore, hasNextBatch, isPending } = useIncrementalLoading<{
            id: string;
        }>({ service });

        await fetchInitial();

        const more = fetchMore();
        const refresh = fetchInitial();
        await refresh;
        resolveStalePage!();
        await more;

        expect(service).toHaveBeenCalledTimes(3);
        expect(items.value).toStrictEqual([{ id: 'fresh' }]);
        expect(hasNextBatch.value).toBe(true);
        expect(isPending.value).toBe(false);
    });

    it('fetchAll records a failure and stops loading, so a later load still runs', async () => {
        const service = vi
            .fn()
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce(createSuccessResponse([{ id: '1' }], 1));

        const { items, error, fetchAll, fetchInitial, isPending } = useIncrementalLoading<{
            id: string;
        }>({ service });

        await expect(fetchAll()).resolves.toBeUndefined();

        expect(error.value).toStrictEqual(new Error('Network error'));
        expect(isPending.value).toBe(false);

        await fetchInitial();

        expect(service).toHaveBeenCalledTimes(2);
        expect(error.value).toBeNull();
        expect(items.value).toStrictEqual([{ id: '1' }]);
    });

    it('fetchAll records an error response as a failure', async () => {
        const service = vi.fn().mockResolvedValue({ message: 'Forbidden', hasError: true });

        const { error, fetchAll, isPending } = useIncrementalLoading({ service });

        await fetchAll();

        expect(error.value).toStrictEqual(new Error('Forbidden'));
        expect(isPending.value).toBe(false);
    });
});

describe('useIncrementalLoading across pages, races and failures', () => {
    type Item = { id: string };

    const pageOf = (page: number, hasNext: boolean, size = 15) => ({
        data: Array.from({ length: size }, (_, i) => ({ id: `sub_${page}_${i}` })),
        page,
        limit: size,
        links: { current: `?page=${page}`, next: hasNext ? `?page=${page + 1}` : null },
    });

    const deferred = <T>() => {
        let resolve!: (value: T) => void;
        let reject!: (reason: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    it('loads every page after the first, without duplicates, and stops on the last', async () => {
        const service = vi.fn((page: number) => Promise.resolve(pageOf(page, page < 3)));
        const list = useIncrementalLoading<Item>({ service: service as never });

        await list.fetchInitial();
        expect(list.hasNextBatch.value).toBe(true);
        await list.fetchMore();
        await list.fetchMore();

        const ids = list.items.value.map(({ id }) => id);
        expect(ids).toHaveLength(45);
        expect(new Set(ids).size).toBe(45);
        expect(list.hasNextBatch.value).toBe(false);
        expect(service.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
    });

    it('drops a second load-more while one is in flight', async () => {
        const second = deferred<ReturnType<typeof pageOf>>();
        const service = vi
            .fn()
            .mockResolvedValueOnce(pageOf(1, true))
            .mockReturnValueOnce(second.promise);
        const list = useIncrementalLoading<Item>({ service });

        await list.fetchInitial();
        const a = list.fetchMore();
        const b = list.fetchMore();
        second.resolve(pageOf(2, false));
        await Promise.all([a, b]);

        expect(service).toHaveBeenCalledTimes(2);
        expect(list.items.value).toHaveLength(30);
    });

    it('lets a refresh during load-more win, whichever answers first', async () => {
        for (const order of ['more-first', 'refresh-first'] as const) {
            const more = deferred<ReturnType<typeof pageOf>>();
            const refresh = deferred<ReturnType<typeof pageOf>>();
            const service = vi
                .fn()
                .mockResolvedValueOnce(pageOf(1, true))
                .mockReturnValueOnce(more.promise)
                .mockReturnValueOnce(refresh.promise);
            const list = useIncrementalLoading<Item>({ service });

            await list.fetchInitial();
            const pendingMore = list.fetchMore();
            const pendingRefresh = list.fetchInitial();

            const fresh = { ...pageOf(1, true), data: [{ id: 'fresh' }] };
            if (order === 'more-first') {
                more.resolve(pageOf(2, false));
                await pendingMore;
                refresh.resolve(fresh);
            } else {
                refresh.resolve(fresh);
                await pendingRefresh;
                more.resolve(pageOf(2, false));
            }
            await Promise.all([pendingMore, pendingRefresh]);

            expect(list.items.value).toEqual([{ id: 'fresh' }]);
            expect(list.hasNextBatch.value).toBe(true);
            expect(list.isPending.value).toBe(false);

            // The next load-more asks for page 2 again, not page 3.
            service.mockResolvedValueOnce(pageOf(2, false));
            await list.fetchMore();
            expect(service).toHaveBeenLastCalledWith(2);
        }
    });

    it('keeps the loaded items when a load-more fails, and retries the same page', async () => {
        const service = vi
            .fn()
            .mockResolvedValueOnce(pageOf(1, true))
            .mockRejectedValueOnce(new Error('Boom'))
            .mockResolvedValueOnce(pageOf(2, false));
        const list = useIncrementalLoading<Item>({ service });

        await list.fetchInitial();
        await list.fetchMore();

        expect(list.items.value).toHaveLength(15);
        expect(list.error.value?.message).toBe('Boom');
        expect(list.isPending.value).toBe(false);
        expect(list.hasNextBatch.value).toBe(true);

        await list.fetchMore();

        expect(service).toHaveBeenLastCalledWith(2);
        expect(list.items.value).toHaveLength(30);
        expect(list.error.value).toBeNull();
    });

    it('recovers from a failed fetchAll on the next call', async () => {
        const service = vi
            .fn()
            .mockRejectedValueOnce(new Error('Boom'))
            .mockResolvedValueOnce(pageOf(1, false, 2));
        const list = useIncrementalLoading<Item>({ service });

        await expect(list.fetchAll()).resolves.toBeUndefined();
        expect(list.error.value?.message).toBe('Boom');
        expect(list.isPending.value).toBe(false);

        await list.fetchAll();
        expect(list.error.value).toBeNull();
        expect(list.items.value).toHaveLength(2);
    });
});
