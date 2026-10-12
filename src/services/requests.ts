import type { ApiSuccessCollectionResponse } from '@solvimon/solvimon-types';
import { version } from '../../package.json';
import { ApiError } from './apiError';
import type {
    CollectionRequestParams,
    RequestOptions,
    RequestParams,
    SingleRequestParams,
    GetDefaultHeaders,
} from './requests.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { appendQueryParams, getMediaType, Headers, MediaType } from '@/services/requests.lib';
import { useAuth } from '@/components/providers/AuthProvider';

type ErrorBody = Partial<Record<'message' | 'field' | 'resource_type' | 'resource_id', string>>;

/** The fields an API error body carries, each only when it is a string. */
function readErrorBody(json: unknown): ErrorBody {
    if (typeof json !== 'object' || json === null) return {};

    const body: ErrorBody = {};
    for (const key of ['message', 'field', 'resource_type', 'resource_id'] as const) {
        const value: unknown = Reflect.get(json, key);
        if (typeof value === 'string') body[key] = value;
    }

    return body;
}

const defaultOptions: RequestOptions = {
    method: 'GET',
    credentials: 'omit',
};

export function createRequestService({ enableAccessCheck } = { enableAccessCheck: true }) {
    const logger = useLogger();
    // Resolved here because inject() is only valid during setup, but read per request: the token
    // is refreshed in the background, and a value captured now would never be replaced.
    const auth = enableAccessCheck ? useAuth() : undefined;

    const getDefaultHeaders: GetDefaultHeaders = ({ headers: overrides = {}, accessToken }) => {
        const headers = {
            [Headers.CONTENT_TYPE]: 'application/json',
            [Headers.X_CLIENT_VERSION]: `solvimon-web-v${version}`,
            ...(auth ? { [Headers.AUTHORIZATION]: `Bearer ${accessToken}` } : {}),
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

    /** The one entry a failed request produces; callers add their own code on top. */
    function reportFailure(
        url: URL,
        options: RequestOptions,
        error: unknown,
        parseError?: unknown,
    ) {
        const statusCode = error instanceof ApiError ? error.statusCode : undefined;
        const isExpected = !!statusCode && !!options.expectedStatusCodes?.includes(statusCode);

        const context = {
            // Path only: a query string carries customer data.
            path: url.pathname,
            method: options.method,
            ...(statusCode ? { statusCode } : {}),
            ...(error instanceof ApiError && error.requestId ? { requestId: error.requestId } : {}),
            fingerprint: [
                parseError ? 'REQUEST_PARSE_FAILED' : 'REQUEST_FAILED',
                options.method ?? 'GET',
                url.pathname,
                `${statusCode}`,
            ],
        };

        if (parseError) {
            logger.error(
                'REQUEST_PARSE_FAILED',
                'Failed to parse JSON response',
                context,
                parseError,
            );
            return;
        }

        if (isExpected) {
            logger.warn('REQUEST_FAILED', 'Request failed with an expected status', context, error);
            return;
        }

        logger.error('REQUEST_FAILED', 'Request failed', context, error);
    }

    async function request<T>(params: SingleRequestParams): Promise<T>;
    async function request<T>(
        params: CollectionRequestParams,
    ): Promise<ApiSuccessCollectionResponse<T>>;
    async function request<T>({
        url,
        data = undefined,
        options: rawOptions,
        query,
    }: RequestParams): Promise<T | ApiSuccessCollectionResponse<T> | Blob | string | undefined> {
        const options = { ...defaultOptions, ...rawOptions };
        let parseError: unknown;

        const fullUrl = new URL(url);
        appendQueryParams(fullUrl, query);

        const send = (accessToken?: string) =>
            fetch(fullUrl.toString(), {
                method: options.method,
                headers: getDefaultHeaders({ headers: options.headers, accessToken }),
                credentials: options.credentials,
                body: data ? JSON.stringify(data) : undefined,
            });

        try {
            const accessToken = await auth?.getFreshAccessToken();
            let response = await send(accessToken);

            // The token can lapse between the expiry check and the server reading it; one retry
            // with a renewed token, and the 401 stands when there is none.
            if (auth && response.status === 401) {
                const renewed = await auth.renewAccessToken(accessToken);
                if (renewed) response = await send(renewed);
            }

            const mediaType = getMediaType(response.headers.get(Headers.CONTENT_TYPE));
            const isJson = mediaType === MediaType.JSON;

            let json: T | undefined;

            // Parsed before the status is checked, because an error body is where the message and
            // the field it belongs to come from.
            if (isJson) {
                try {
                    json = await response.json();
                } catch (error) {
                    parseError = error;

                    throw new ApiError({
                        statusCode: response.status,
                        message: 'Failed to parse JSON response',
                        requestId: response.headers.get(Headers.X_REQUEST_ID),
                    });
                }
            }

            // Checked once, for every content type: a PDF endpoint answering with an HTML error
            // page has to reject, not resolve with the page as if it were the file.
            if (!response.ok) {
                const body = readErrorBody(json);

                throw new ApiError({
                    statusCode: response.status,
                    message: body.message,
                    requestId: response.headers.get(Headers.X_REQUEST_ID),
                    field: body.field,
                    resourceType: body.resource_type,
                    resourceId: body.resource_id,
                });
            }

            if (mediaType === MediaType.PDF) {
                return response.blob();
            }

            if (!isJson) {
                return response.text();
            }

            return json;
        } catch (error) {
            reportFailure(fullUrl, options, error, parseError);
            return Promise.reject(error);
        }
    }

    return request;
}
