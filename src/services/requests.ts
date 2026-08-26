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
import { appendQueryParams, Headers } from '@/services/requests.lib';
import { useAuth } from '@/components/providers/AuthProvider';

const defaultOptions: RequestOptions = {
    method: 'GET',
};

export function createRequestService({ enableAccessCheck } = { enableAccessCheck: true }) {
    const { onError } = useErrorHandling();
    const logger = useLogger();
    // Resolved here because inject() is only valid during setup, but read per request: the token
    // is refreshed in the background, and a value captured now would never be replaced.
    const auth = enableAccessCheck ? useAuth() : undefined;

    const getDefaultHeaders: GetDefaultHeaders = ({ headers: overrides = {} }) => {
        const headers = {
            [Headers.CONTENT_TYPE]: 'application/json',
            [Headers.X_CLIENT_VERSION]: `solvimon-web-v${version}`,
            ...(auth ? { [Headers.AUTHORIZATION]: `Bearer ${auth.accessToken.value}` } : {}),
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
        appendQueryParams(fullUrl, query);

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

            let json;

            try {
                json = await response.json();
            } catch (error) {
                logger.error('REQUEST_PARSE_FAILED', 'Failed to parse JSON response', {}, error);
                onError?.(new Error('Failed to parse JSON response', { cause: error }));

                throw {
                    hasError: true,
                    statusCode: response.status,
                    requestId: response.headers.get(Headers.X_REQUEST_ID),
                };
            }

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
            onError?.(new Error('Request failed', { cause: error }));
            return Promise.reject(error);
        }
    }

    return request;
}
