import { ApiStatus, type ApiCollectionResponse } from '@solvimon/solvimon-types';
import { getPaginatedFullList, isApiSuccessCollectionResponse } from '@solvimon/solvimon-ui';
import { computed, ref, shallowRef } from 'vue';

function toError(error: unknown) {
    return error instanceof Error ? error : new Error('Something went wrong while fetching data.');
}

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

    const loadPage = async (pageNumber: number) => {
        // Prevent concurrent requests
        if (isPending.value) return;

        try {
            // Reset the loading state
            error.value = null;
            status.value = ApiStatus.Loading;

            // Fetch the date
            const response = await service(pageNumber);

            // Check if we get a valid response
            if (!isApiSuccessCollectionResponse(response)) {
                status.value = ApiStatus.Done;
                return;
            }

            // Check if there is a next batch
            hasNextBatch.value = !!response.links?.next;

            items.value = [...items.value, ...response.data];
            status.value = ApiStatus.Done;
            page.value = pageNumber;
        } catch (err) {
            error.value = toError(err);
            status.value = ApiStatus.Failed;
        }
    };

    const fetchAll = async () => {
        error.value = null;
        status.value = ApiStatus.Loading;

        const response = await getPaginatedFullList(async (pageNum: number) => {
            const response = await service(pageNum);
            if (!isApiSuccessCollectionResponse(response)) {
                status.value = ApiStatus.Failed;

                throw new Error('message' in response ? response.message : 'Request failed');
            }
            return response;
        });

        items.value = response.data;
        status.value = ApiStatus.Done;
    };

    const fetchMore = async () => {
        return await loadPage(page.value + 1);
    };

    const nonMutableItems = computed(() => structuredClone(items.value));

    const fetchInitial = async () => {
        return await loadPage(1);
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
