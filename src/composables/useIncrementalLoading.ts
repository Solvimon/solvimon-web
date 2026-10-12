import { ApiStatus, type ApiCollectionResponse } from '@solvimon/solvimon-types';
import { getPaginatedFullList, isApiSuccessCollectionResponse } from '@solvimon/solvimon-ui';
import { computed, ref, shallowRef } from 'vue';
import { toError } from '@/utils/error';

export function useIncrementalLoading<T>({
    initialData = [],
    service,
}: {
    initialData?: T[];
    service: (page: number) => Promise<ApiCollectionResponse<T>>;
}) {
    const items = shallowRef<T[]>(initialData);
    const status = ref<ApiStatus>(ApiStatus.Initial);
    const error = ref<Error | null>(null);
    const page = ref<number>(1);
    const hasNextBatch = ref<boolean>(false);
    const isPending = computed<boolean>(() => status.value === ApiStatus.Loading);

    /** Only the latest request may write: a refresh supersedes whatever was in flight before it. */
    let latestRequest = 0;

    const loadPage = async (pageNumber: number, { replace = false } = {}) => {
        // A refresh always runs; another page waits until nothing is in flight
        if (!replace && isPending.value) return;

        const request = ++latestRequest;

        try {
            // Reset the loading state
            error.value = null;
            status.value = ApiStatus.Loading;

            // Fetch the date
            const response = await service(pageNumber);

            if (request !== latestRequest) return;

            // Check if we get a valid response
            if (!isApiSuccessCollectionResponse(response)) {
                status.value = ApiStatus.Done;
                return;
            }

            // Check if there is a next batch
            hasNextBatch.value = !!response.links?.next;

            items.value = replace ? response.data : [...items.value, ...response.data];
            status.value = ApiStatus.Done;
            page.value = pageNumber;
        } catch (err) {
            if (request !== latestRequest) return;

            error.value = toError(err);
            status.value = ApiStatus.Failed;
        }
    };

    const fetchAll = async () => {
        const request = ++latestRequest;

        error.value = null;
        status.value = ApiStatus.Loading;

        try {
            const response = await getPaginatedFullList(async (pageNum: number) => {
                const response = await service(pageNum);
                if (!isApiSuccessCollectionResponse(response)) {
                    throw new Error('message' in response ? response.message : 'Request failed');
                }
                return response;
            });

            if (request !== latestRequest) return;

            items.value = response.data;
            hasNextBatch.value = false;
            status.value = ApiStatus.Done;
        } catch (err) {
            if (request !== latestRequest) return;

            error.value = toError(err);
            status.value = ApiStatus.Failed;
        }
    };

    const fetchMore = async () => {
        return await loadPage(page.value + 1);
    };

    const nonMutableItems = computed(() => [...items.value]);

    const fetchInitial = async () => {
        return await loadPage(1, { replace: true });
    };

    return {
        items: nonMutableItems,
        error,
        fetchInitial,
        fetchMore,
        fetchAll,
        isPending,
        hasNextBatch,
    };
}
