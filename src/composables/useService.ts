import { ApiStatus } from '@solvimon/solvimon-types';
import { computed, ref, shallowRef } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { updateRefIfChanged } from '@/utils/ref';

type CollectionResponse<TData> = {
    data: TData;
};

type ServiceResponseData<TResponse> =
    TResponse extends CollectionResponse<infer TData> ? TData : TResponse;

type Service<TArgs extends unknown[], TResponse> = (...args: TArgs) => Promise<TResponse>;

type UseServiceState<TData, TArgs extends unknown[], TFetchResult = TData> = {
    data: Ref<TData>;
    execute: (...args: TArgs) => Promise<TFetchResult>;
    apiStatus: Ref<ApiStatus>;
    isPending: ComputedRef<boolean>;
    error: Ref<Error | null>;
};

function toError(error: unknown) {
    return error instanceof Error ? error : new Error('Something went wrong while fetching data.');
}

function isCollectionResponse<TData>(
    response: TData | CollectionResponse<TData>,
): response is CollectionResponse<TData> {
    return typeof response === 'object' && response !== null && 'data' in response;
}

function getCollectionResponseData<TData>(response: TData | CollectionResponse<TData>): TData {
    if (!isCollectionResponse(response)) {
        throw new Error('Expected collection response.');
    }

    return response.data;
}

function mapServiceResponse<TResponse>(
    response: TResponse,
    isCollection: boolean,
): ServiceResponseData<TResponse>;
function mapServiceResponse<TResponse>(response: TResponse, isCollection: boolean): unknown {
    return isCollection ? getCollectionResponseData(response) : response;
}

export function useService<TArgs extends unknown[], TData>({
    initialValue,
    service,
    isCollection,
}: {
    initialValue: TData;
    service: Service<TArgs, CollectionResponse<TData>>;
    isCollection: true;
}): UseServiceState<TData, TArgs>;
export function useService<TArgs extends unknown[], TData>({
    initialValue,
    service,
    isCollection,
}: {
    initialValue?: undefined;
    service: Service<TArgs, CollectionResponse<TData>>;
    isCollection: true;
}): UseServiceState<TData | undefined, TArgs, TData>;
export function useService<TArgs extends unknown[], TData>({
    initialValue,
    service,
    isCollection,
}: {
    initialValue: TData;
    service: Service<TArgs, TData>;
    isCollection?: false;
}): UseServiceState<TData, TArgs>;
export function useService<TArgs extends unknown[], TData>({
    initialValue,
    service,
    isCollection,
}: {
    initialValue?: undefined;
    service: Service<TArgs, TData>;
    isCollection?: false;
}): UseServiceState<TData | undefined, TArgs, TData>;
export function useService<TArgs extends unknown[], TResponse>({
    initialValue,
    service,
    isCollection = false,
}: {
    initialValue?: ServiceResponseData<TResponse>;
    service: Service<TArgs, TResponse>;
    isCollection?: boolean;
}) {
    const data: Ref<ServiceResponseData<TResponse> | undefined> = shallowRef(initialValue);
    const apiStatus = ref<ApiStatus>(ApiStatus.Initial);
    const error = ref<Error | null>(null);
    const isPending = computed(() => apiStatus.value === ApiStatus.Loading);

    const execute = async (...args: TArgs): Promise<ServiceResponseData<TResponse>> => {
        try {
            apiStatus.value = ApiStatus.Loading;
            error.value = null;
            const response = await service(...args);
            const mapped = mapServiceResponse(response, isCollection);
            updateRefIfChanged(data, mapped);
            apiStatus.value = ApiStatus.Done;
            return mapped;
        } catch (err) {
            error.value = toError(err);
            apiStatus.value = ApiStatus.Failed;
            return Promise.reject();
        }
    };

    return { data, execute, apiStatus, isPending, error };
}
