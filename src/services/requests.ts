import type { ApiSuccessCollectionResponse } from '@solvimon/types';
import { useErrorHandling } from '@solvimon/ui';
import type {
    CollectionRequestParams,
    RequestOptions,
    RequestParams,
    SingleRequestParams,
    GetDefaultHeaders,
} from './requests.types';
import { Headers } from '@/services/requests.lib';
import { useAuth } from '@/components/providers/AuthProvider';

const defaultOptions: RequestOptions = {
    method: 'GET',
};

export function createRequestService({ enableAccessCheck } = { enableAccessCheck: true }) {
    const { onError } = useErrorHandling();
    const authHeaders = enableAccessCheck
        ? { [Headers.AUTHORIZATION]: `Bearer ${useAuth().accessToken.value}` }
        : {};

    const getDefaultHeaders: GetDefaultHeaders = ({ headers: overrides = {} }) => {
        const headers = {
            [Headers.CONTENT_TYPE]: 'application/json',
            ...authHeaders,
        };

        if (overrides) {
            Object.entries(overrides).forEach(([key, value]) => {
                if (value === null) {
                    delete headers[key];
                } else {
                    headers[key] = value;
                }
            });
        }

        return headers;
    };

    async function request<T>(params: SingleRequestParams): Promise<T>;
    async function request<T>(
        params: CollectionRequestParams,
    ): Promise<ApiSuccessCollectionResponse<T>>;
    async function request<T>({
        url,
        data = undefined,
        options: rawOptions,
        query,
    }: RequestParams): Promise<T | ApiSuccessCollectionResponse<T>> {
        const options = { ...defaultOptions, ...rawOptions };

        const fullUrl = new URL(url);
        Object.entries(query ?? {}).forEach(([key, value]) => {
            fullUrl.searchParams.append(key, `${value}`);
        });

        try {
            const response = await fetch(fullUrl.toString(), {
                method: options.method,
                headers: getDefaultHeaders({
                    headers: options.headers,
                }),
                credentials: 'include',
                body: data ? JSON.stringify(data) : undefined,
            });

            if (response.headers.get('Content-Type') === 'application/pdf') {
                return (await response.blob()) as T;
            }

            if (!(response.headers.get('Content-Type') === 'application/json')) {
                return (await response.text()) as T;
            }

            try {
                const json = await response.json();

                if (!response.ok) {
                    throw {
                        hasError: true,
                        statusCode: response.status,
                        message: json?.message,
                        requestId: response.headers.get(Headers.X_REQUEST_ID),
                        field: json?.field,
                    };
                }

                return json;
            } catch (error) {
                // Log to console, to make debugging easier. Also for back-end devs
                // eslint-disable-next-line no-console
                console.error(error);
                onError?.(new Error('Failed to parse JSON response', { cause: error }));

                throw {
                    hasError: true,
                    statusCode: response.status,
                    requestId: response.headers.get(Headers.X_REQUEST_ID),
                };
            }
        } catch (error) {
            onError?.(new Error('Request failed', { cause: error }));
            return Promise.reject(error);
        }
    }

    return request;
}
