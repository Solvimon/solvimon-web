import { ApiStatus } from '@solvimon/types';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { updateRefIfChanged } from '@/utils/ref';

type CollectionResponse<TData> = {
    data: TData;
};

type ServiceArgs<TService> = TService extends (...args: infer TArgs) => Promise<unknown>
    ? TArgs
    : never;

type ServiceResponseData<TResponse> =
    TResponse extends CollectionResponse<infer TData> ? TData : TResponse;

type ServiceFetchResult<TService extends (...args: never[]) => Promise<unknown>> =
    ServiceResponseData<Awaited<ReturnType<TService>>>;

type UseServiceState<
    TData,
    TService extends (...args: never[]) => Promise<unknown>,
    TFetchResult = ServiceFetchResult<TService>,
> = {
    data: Ref<TData>;
    fetch: (...args: ServiceArgs<TService>) => Promise<TFetchResult>;
    apiStatus: Ref<ApiStatus>;
    isPending: ComputedRef<boolean>;
    error: Ref<Error | null>;
};

function toError(error: unknown) {
    return error instanceof Error ? error : new Error('Something went wrong while fetching data.');
}

function isCollectionResponse<TData>(
    response: TData | CollectionResponse<TData>,
    isCollection: boolean,
): response is CollectionResponse<TData> {
    return isCollection;
}

export function useService<
    TService extends (...args: never[]) => Promise<CollectionResponse<unknown>>,
>({
    initialValue,
    service,
    isCollection,
}: {
    initialValue: ServiceFetchResult<TService>;
    service: TService;
    isCollection: true;
}): UseServiceState<ServiceFetchResult<TService>, TService>;
export function useService<
    TService extends (...args: never[]) => Promise<CollectionResponse<unknown>>,
>({
    initialValue,
    service,
    isCollection,
}: {
    initialValue?: undefined;
    service: TService;
    isCollection: true;
}): UseServiceState<ServiceFetchResult<TService> | undefined, TService>;
export function useService<TService extends (...args: never[]) => Promise<unknown>>({
    initialValue,
    service,
    isCollection,
}: {
    initialValue: ServiceFetchResult<TService>;
    service: TService;
    isCollection?: false;
}): UseServiceState<ServiceFetchResult<TService>, TService>;
export function useService<TService extends (...args: never[]) => Promise<unknown>>({
    initialValue,
    service,
    isCollection,
}: {
    initialValue?: undefined;
    service: TService;
    isCollection?: false;
}): UseServiceState<ServiceFetchResult<TService> | undefined, TService>;
export function useService<TService extends (...args: never[]) => Promise<unknown>>({
    initialValue,
    service,
    isCollection = false,
}: {
    initialValue?: ServiceFetchResult<TService>;
    service: TService;
    isCollection?: boolean;
}) {
    const data = ref<ServiceFetchResult<TService> | undefined>(initialValue);
    const apiStatus = ref<ApiStatus>(ApiStatus.Initial);
    const error = ref<Error | null>(null);
    const isPending = computed(() => apiStatus.value === ApiStatus.Loading);

    const fetch = async (...args: ServiceArgs<TService>): Promise<ServiceFetchResult<TService>> => {
        try {
            apiStatus.value = ApiStatus.Loading;
            error.value = null;
            const response = await service(...args);
            const mapped = (
                isCollectionResponse(response, isCollection) ? response.data : response
            ) as ServiceFetchResult<TService>;
            updateRefIfChanged(data as Ref<ServiceFetchResult<TService> | undefined>, mapped);
            apiStatus.value = ApiStatus.Done;
            return mapped;
        } catch (err) {
            error.value = toError(err);
            apiStatus.value = ApiStatus.Failed;
            return Promise.reject();
        }
    };

    return { data, fetch, apiStatus, isPending, error };
}
