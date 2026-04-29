import { ApiStatus } from '@solvimon/solvimon-types';
import { useIncrementalLoading } from './useIncrementalLoading';

const mockGetPaginatedFullList = vi.fn();

vi.mock('@solvimon/solvimon-ui', () => ({
    getPaginatedFullList: (...args: unknown[]) => mockGetPaginatedFullList(...args),
    isApiSuccessCollectionResponse: (response: unknown) =>
        response !== null &&
        typeof response === 'object' &&
        'data' in response &&
        'links' in response,
}));

describe('useIncrementalLoading', () => {
    const createSuccessResponse = <T>(
        data: T[],
        page: number,
        hasNext = false,
    ) => ({
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
        const service = vi
            .fn()
            .mockResolvedValueOnce(createSuccessResponse(page1Data, 1, true));
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

    it('returns items as a deep clone (nonMutableItems) so internal ref is not exposed', async () => {
        const service = vi
            .fn()
            .mockResolvedValue(createSuccessResponse([{ id: '1' }], 1));
        const { items, fetchInitial } = useIncrementalLoading<{ id: string }>({ service });

        await fetchInitial();
        expect(items.value).toStrictEqual([{ id: '1' }]);
    });

    it('fetchAll loads full list via getPaginatedFullList and replaces items', async () => {
        const fullData = [{ id: 'a' }, { id: 'b' }];
        mockGetPaginatedFullList.mockResolvedValue({
            data: fullData,
            page: 1,
            limit: 10,
            links: { current: '/', next: undefined, previous: undefined },
        });

        const service = vi.fn();
        const { items, fetchAll, isPending } = useIncrementalLoading<{ id: string }>({
            initialData: [{ id: 'initial' }],
            service,
        });

        await fetchAll();

        expect(mockGetPaginatedFullList).toHaveBeenCalledTimes(1);
        expect(items.value).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
        expect(isPending.value).toBe(false);
    });

    it('does not run concurrent loadPage when already pending', async () => {
        let resolveFirst: () => void;
        const firstPromise = new Promise<ReturnType<typeof createSuccessResponse>>((resolve) => {
            resolveFirst = () => resolve(createSuccessResponse([{ id: '1' }], 1));
        });
        const service = vi.fn().mockReturnValue(firstPromise);

        const { items, fetchInitial } = useIncrementalLoading<{ id: string }>({ service });

        const p1 = fetchInitial();
        const p2 = fetchInitial();

        resolveFirst!();
        await Promise.all([p1, p2]);

        expect(service).toHaveBeenCalledTimes(1);
        expect(items.value).toStrictEqual([{ id: '1' }]);
    });
});
