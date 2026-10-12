import { useIncrementalLoading } from './useIncrementalLoading';

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

describe('DD-3545 tester: useIncrementalLoading', () => {
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
