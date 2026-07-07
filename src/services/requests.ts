import type { ApiSuccessCollectionResponse } from '@solvimon/solvimon-types';
import { useErrorHandling } from '@solvimon/solvimon-ui';
import { version } from '../../package.json';
import type {
    CollectionRequestParams,
    RequestOptions,
    RequestParams,
    SingleRequestParams,
    GetDefaultHeaders,
} from './requests.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { Headers } from '@/services/requests.lib';
import { useAuth } from '@/components/providers/AuthProvider';

const defaultOptions: RequestOptions = {
    method: 'GET',
};

export function createRequestService({ enableAccessCheck } = { enableAccessCheck: true }) {
    const { onError } = useErrorHandling();
    const logger = useLogger();
    const authHeaders = enableAccessCheck
        ? { [Headers.AUTHORIZATION]: `Bearer ${useAuth().accessToken.value}` }
        : {};

    const getDefaultHeaders: GetDefaultHeaders = ({ headers: overrides = {} }) => {
        const headers = {
            [Headers.CONTENT_TYPE]: 'application/json',
            [Headers.X_CLIENT_VERSION]: `solvimon-web-v${version}`,
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
    }: RequestParams): Promise<T | ApiSuccessCollectionResponse<T> | Blob | string> {
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
                credentials: 'omit',
                body: data ? JSON.stringify(data) : undefined,
            });

            if (response.headers.get('Content-Type') === 'application/pdf') {
                return response.blob();
            }

            if (!(response.headers.get('Content-Type') === 'application/json')) {
                return response.text();
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
                logger.error('REQUEST_PARSE_FAILED', 'Failed to parse JSON response', {}, error);
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
